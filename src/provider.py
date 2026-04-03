"""AI Provider Client for Baba Code.

Supports Jan AI, Ollama, LM Studio, and OpenAI-compatible APIs.
All these providers expose an OpenAI-compatible REST API.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Generator, Optional

import httpx

from .config import ProviderConfig, ProviderType, get_config

logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    """A chat message in the conversation."""
    role: str  # "system", "user", or "assistant"
    content: str


@dataclass
class ChatResponse:
    """Response from a chat completion request."""
    content: str
    model: str
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str = "stop"
    raw_response: dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamChunk:
    """A chunk of streamed response."""
    content: str
    finish_reason: Optional[str] = None


class ProviderClient:
    """Client for communicating with AI providers."""
    
    def __init__(self, config: Optional[ProviderConfig] = None):
        """Initialize the provider client.
        
        Args:
            config: Provider configuration. Uses primary provider from env if not specified.
        """
        self.config = config or get_config().primary_provider
        self._client: Optional[httpx.Client] = None
    
    @property
    def client(self) -> httpx.Client:
        """Get or create the HTTP client."""
        if self._client is None:
            self._client = httpx.Client(
                base_url=self.config.base_url,
                timeout=self.config.timeout,
                headers={
                    "Authorization": f"Bearer {self.config.api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client
    
    def close(self) -> None:
        """Close the HTTP client."""
        if self._client:
            self._client.close()
            self._client = None
    
    def __enter__(self) -> "ProviderClient":
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()
    
    def chat_completion(
        self,
        messages: list[ChatMessage],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ) -> ChatResponse | Generator[StreamChunk, None, None]:
        """Send a chat completion request.
        
        Args:
            messages: List of chat messages.
            model: Model name to use (overrides config default).
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            stream: Whether to stream the response.
            
        Returns:
            ChatResponse if not streaming, else generator of StreamChunk.
        """
        model = model or self.config.model
        temperature = temperature if temperature is not None else 0.7
        max_tokens = max_tokens or 4096
        
        payload = {
            "model": model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": stream,
        }
        
        logger.debug(f"Sending chat completion request: {payload}")
        
        if stream:
            return self._stream_completion(payload)
        else:
            return self._sync_completion(payload)
    
    def _sync_completion(self, payload: dict[str, Any]) -> ChatResponse:
        """Make a synchronous (non-streaming) completion request."""
        try:
            response = self.client.post("/chat/completions", json=payload)
            response.raise_for_status()
            data = response.json()
            
            return ChatResponse(
                content=data["choices"][0]["message"]["content"],
                model=data.get("model", self.config.model),
                usage=data.get("usage", {}),
                finish_reason=data["choices"][0].get("finish_reason", "stop"),
                raw_response=data,
            )
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during chat completion: {e}")
            raise ProviderError(f"Chat completion failed: {e}")
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error(f"Failed to parse response: {e}")
            raise ProviderError(f"Invalid response format: {e}")
    
    def _stream_completion(
        self, payload: dict[str, Any]
    ) -> Generator[StreamChunk, None, None]:
        """Make a streaming completion request."""
        try:
            with self.client.stream(
                "POST",
                "/chat/completions",
                json=payload,
                timeout=self.config.timeout,
            ) as response:
                response.raise_for_status()
                
                for line in response.iter_lines():
                    if not line.strip():
                        continue
                    
                    # SSE format: data: {...}
                    if line.startswith("data: "):
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        
                        try:
                            data = json.loads(data_str)
                            choice = data["choices"][0]
                            delta = choice.get("delta", {})
                            content = delta.get("content", "")
                            finish_reason = choice.get("finish_reason")
                            
                            if content:
                                yield StreamChunk(
                                    content=content,
                                    finish_reason=finish_reason,
                                )
                        except (json.JSONDecodeError, KeyError, IndexError) as e:
                            logger.warning(f"Failed to parse stream chunk: {e}")
                            continue
                            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error during streaming: {e}")
            raise ProviderError(f"Streaming failed: {e}")
    
    def check_health(self) -> bool:
        """Check if the provider is healthy and reachable.
        
        Returns:
            True if the provider is reachable, False otherwise.
        """
        try:
            # Try a simple models endpoint ping
            response = self.client.get("/models", timeout=5)
            return response.status_code in (200, 404)  # 404 is OK for some providers
        except httpx.HTTPError:
            return False
    
    def list_models(self) -> list[str]:
        """List available models from the provider.
        
        Returns:
            List of model names.
        """
        try:
            response = self.client.get("/models", timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # OpenAI-compatible format
            if "data" in data:
                return [model.get("id", "") for model in data["data"] if model.get("id")]
            
            # Some providers use different formats
            return []
        except (httpx.HTTPError, json.JSONDecodeError, KeyError):
            return []


class ProviderPool:
    """Manages multiple providers with fallback support."""
    
    def __init__(self):
        """Initialize the provider pool."""
        self.config = get_config()
        self._clients: dict[ProviderType, ProviderClient] = {}
    
    def get_client(self, provider_type: Optional[ProviderType] = None) -> ProviderClient:
        """Get a client for the specified provider type.
        
        Args:
            provider_type: Provider type to use. Uses primary if not specified.
            
        Returns:
            ProviderClient instance.
        """
        if provider_type is None:
            provider_type = self.config.primary_provider.provider_type
        
        if provider_type not in self._clients:
            # Find the config for this provider type
            provider_config = None
            for provider in self.config.get_all_providers():
                if provider.provider_type == provider_type:
                    provider_config = provider
                    break
            
            if provider_config is None:
                raise ValueError(f"Unknown provider type: {provider_type}")
            
            self._clients[provider_type] = ProviderClient(provider_config)
        
        return self._clients[provider_type]
    
    def get_healthy_client(self) -> tuple[ProviderClient, ProviderType]:
        """Get a healthy client, trying providers in priority order.
        
        Returns:
            Tuple of (ProviderClient, ProviderType) for the first healthy provider.
            
        Raises:
            ProviderError: If no providers are healthy.
        """
        for provider in self.config.get_all_providers():
            try:
                client = self.get_client(provider.provider_type)
                if client.check_health():
                    logger.info(f"Using healthy provider: {provider.provider_type.value}")
                    return client, provider.provider_type
            except Exception as e:
                logger.warning(f"Provider {provider.provider_type.value} unhealthy: {e}")
        
        raise ProviderError("No healthy providers available")
    
    def chat_with_fallback(
        self,
        messages: list[ChatMessage],
        **kwargs: Any,
    ) -> ChatResponse:
        """Send a chat request with automatic fallback.
        
        Tries providers in priority order until one succeeds.
        
        Args:
            messages: List of chat messages.
            **kwargs: Additional arguments passed to chat_completion.
            
        Returns:
            ChatResponse from the first successful provider.
            
        Raises:
            ProviderError: If all providers fail.
        """
        last_error: Optional[Exception] = None
        
        for provider in self.config.get_all_providers():
            try:
                client = self.get_client(provider.provider_type)
                logger.info(f"Trying provider: {provider.provider_type.value}")
                
                response = client.chat_completion(messages, **kwargs)
                
                # If streaming, we need to handle it differently
                if isinstance(response, Generator):
                    # For now, collect streaming response
                    content_parts = []
                    for chunk in response:
                        content_parts.append(chunk.content)
                    response = ChatResponse(
                        content="".join(content_parts),
                        model=provider.model,
                    )
                
                logger.info(f"Successfully used provider: {provider.provider_type.value}")
                return response
                
            except Exception as e:
                logger.warning(f"Provider {provider.provider_type.value} failed: {e}")
                last_error = e
                continue
        
        raise ProviderError(f"All providers failed. Last error: {last_error}")
    
    def close(self) -> None:
        """Close all clients."""
        for client in self._clients.values():
            client.close()
        self._clients.clear()
    
    def __enter__(self) -> "ProviderPool":
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()


class ProviderError(Exception):
    """Exception raised when provider operations fail."""
    pass


# Convenience functions for simple usage

def chat(
    prompt: str,
    system_prompt: Optional[str] = None,
    conversation_history: Optional[list[ChatMessage]] = None,
    **kwargs: Any,
) -> ChatResponse:
    """Send a chat message with automatic provider fallback.
    
    Args:
        prompt: User prompt.
        system_prompt: Optional system prompt.
        conversation_history: Optional conversation history.
        **kwargs: Additional arguments for chat_completion.
        
    Returns:
        ChatResponse with the model's reply.
    """
    messages = []
    
    if system_prompt:
        messages.append(ChatMessage(role="system", content=system_prompt))
    
    if conversation_history:
        messages.extend(conversation_history)
    
    messages.append(ChatMessage(role="user", content=prompt))
    
    with ProviderPool() as pool:
        return pool.chat_with_fallback(messages, **kwargs)


def stream_chat(
    prompt: str,
    system_prompt: Optional[str] = None,
    conversation_history: Optional[list[ChatMessage]] = None,
    **kwargs: Any,
) -> Generator[str, None, None]:
    """Stream a chat response with automatic provider fallback.
    
    Args:
        prompt: User prompt.
        system_prompt: Optional system prompt.
        conversation_history: Optional conversation history.
        **kwargs: Additional arguments for chat_completion.
        
    Yields:
        Chunks of response text.
    """
    messages = []
    
    if system_prompt:
        messages.append(ChatMessage(role="system", content=system_prompt))
    
    if conversation_history:
        messages.extend(conversation_history)
    
    messages.append(ChatMessage(role="user", content=prompt))
    
    with ProviderPool() as pool:
        client, _ = pool.get_healthy_client()
        response = client.chat_completion(messages, stream=True, **kwargs)
        
        if isinstance(response, Generator):
            for chunk in response:
                yield chunk.content
