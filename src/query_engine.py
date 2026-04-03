from __future__ import annotations

import json
from dataclasses import dataclass, field
from uuid import uuid4

from .commands import build_command_backlog
from .models import PermissionDenial, UsageSummary
from .port_manifest import PortManifest, build_port_manifest
from .provider import ChatMessage, ProviderPool, ProviderError
from .session_store import StoredSession, load_session, save_session
from .tools import build_tool_backlog
from .transcript import TranscriptStore


# Default system prompt for Baba Code
DEFAULT_SYSTEM_PROMPT = """You are Baba Code, an AI coding assistant powered by local AI models.
You help users with software development tasks including:
- Writing and editing code
- Explaining code and concepts
- Debugging issues
- Running commands and tools
- Reading and analyzing files

You have access to various tools and commands to assist with development tasks.
Always be helpful, accurate, and concise in your responses."""


@dataclass(frozen=True)
class QueryEngineConfig:
    max_turns: int = 8
    max_budget_tokens: int = 2000
    compact_after_turns: int = 12
    structured_output: bool = False
    structured_retry_limit: int = 2
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    model: str | None = None
    temperature: float = 0.7
    stream: bool = True


@dataclass(frozen=True)
class TurnResult:
    prompt: str
    output: str
    matched_commands: tuple[str, ...]
    matched_tools: tuple[str, ...]
    permission_denials: tuple[PermissionDenial, ...]
    usage: UsageSummary
    stop_reason: str


@dataclass
class QueryEnginePort:
    manifest: PortManifest
    config: QueryEngineConfig = field(default_factory=QueryEngineConfig)
    session_id: str = field(default_factory=lambda: uuid4().hex)
    mutable_messages: list[str] = field(default_factory=list)
    permission_denials: list[PermissionDenial] = field(default_factory=list)
    total_usage: UsageSummary = field(default_factory=UsageSummary)
    transcript_store: TranscriptStore = field(default_factory=TranscriptStore)
    _provider_pool: ProviderPool | None = field(default=None, repr=False)

    @property
    def provider_pool(self) -> ProviderPool:
        """Get or create the provider pool."""
        if self._provider_pool is None:
            self._provider_pool = ProviderPool()
        return self._provider_pool

    @classmethod
    def from_workspace(cls, config: QueryEngineConfig | None = None) -> 'QueryEnginePort':
        return cls(manifest=build_port_manifest(), config=config or QueryEngineConfig())

    @classmethod
    def from_saved_session(cls, session_id: str) -> 'QueryEnginePort':
        stored = load_session(session_id)
        transcript = TranscriptStore(entries=list(stored.messages), flushed=True)
        return cls(
            manifest=build_port_manifest(),
            session_id=stored.session_id,
            mutable_messages=list(stored.messages),
            total_usage=UsageSummary(stored.input_tokens, stored.output_tokens),
            transcript_store=transcript,
        )

    def submit_message(
        self,
        prompt: str,
        matched_commands: tuple[str, ...] = (),
        matched_tools: tuple[str, ...] = (),
        denied_tools: tuple[PermissionDenial, ...] = (),
    ) -> TurnResult:
        if len(self.mutable_messages) >= self.config.max_turns:
            output = f'Max turns reached before processing prompt: {prompt}'
            return TurnResult(
                prompt=prompt,
                output=output,
                matched_commands=matched_commands,
                matched_tools=matched_tools,
                permission_denials=denied_tools,
                usage=self.total_usage,
                stop_reason='max_turns_reached',
            )

        # Build conversation history for the AI
        messages = [ChatMessage(role="system", content=self.config.system_prompt)]
        
        # Add conversation history
        for msg in self.mutable_messages[-self.config.compact_after_turns:]:
            messages.append(ChatMessage(role="user", content=msg))
            # Add a placeholder assistant response for history structure
            messages.append(ChatMessage(role="assistant", content="Acknowledged."))
        
        # Add current prompt
        messages.append(ChatMessage(role="user", content=prompt))
        
        # Build tool/command context
        context_parts = []
        if matched_commands:
            context_parts.append(f"Matched commands: {', '.join(matched_commands)}")
        if matched_tools:
            context_parts.append(f"Matched tools: {', '.join(matched_tools)}")
        if denied_tools:
            context_parts.append(f"Denied tools: {len(denied_tools)}")
        
        if context_parts:
            # Add context as a system-style message before the user prompt
            context_msg = "\n".join(context_parts)
            messages.append(ChatMessage(role="system", content=context_msg))
        
        # Call AI provider with fallback
        try:
            response = self.provider_pool.chat_with_fallback(
                messages=messages,
                model=self.config.model,
                temperature=self.config.temperature,
                max_tokens=self.config.max_budget_tokens,
                stream=False,
            )
            
            output = response.content
            
            # Update usage stats from provider response
            if response.usage:
                projected_usage = UsageSummary(
                    input_tokens=response.usage.get("prompt_tokens", len(prompt.split())),
                    output_tokens=response.usage.get("completion_tokens", len(output.split())),
                )
            else:
                projected_usage = self.total_usage.add_turn(prompt, output)
                
        except ProviderError as e:
            output = self._build_offline_response(
                prompt,
                matched_commands,
                matched_tools,
                denied_tools,
                str(e),
            )
            projected_usage = self.total_usage.add_turn(prompt, output)
        
        stop_reason = 'completed'
        if projected_usage.input_tokens + projected_usage.output_tokens > self.config.max_budget_tokens:
            stop_reason = 'max_budget_reached'
        
        self.mutable_messages.append(prompt)
        self.transcript_store.append(prompt)
        self.permission_denials.extend(denied_tools)
        self.total_usage = projected_usage
        self.compact_messages_if_needed()
        
        return TurnResult(
            prompt=prompt,
            output=output,
            matched_commands=matched_commands,
            matched_tools=matched_tools,
            permission_denials=denied_tools,
            usage=self.total_usage,
            stop_reason=stop_reason,
        )

    def stream_submit_message(
        self,
        prompt: str,
        matched_commands: tuple[str, ...] = (),
        matched_tools: tuple[str, ...] = (),
        denied_tools: tuple[PermissionDenial, ...] = (),
    ):
        from .provider import stream_chat
        
        yield {'type': 'message_start', 'session_id': self.session_id, 'prompt': prompt}
        if matched_commands:
            yield {'type': 'command_match', 'commands': matched_commands}
        if matched_tools:
            yield {'type': 'tool_match', 'tools': matched_tools}
        if denied_tools:
            yield {'type': 'permission_denial', 'denials': [denial.tool_name for denial in denied_tools]}
        
        # Build conversation history for streaming
        messages = [ChatMessage(role="system", content=self.config.system_prompt)]
        for msg in self.mutable_messages[-self.config.compact_after_turns:]:
            messages.append(ChatMessage(role="user", content=msg))
            messages.append(ChatMessage(role="assistant", content="Acknowledged."))
        messages.append(ChatMessage(role="user", content=prompt))
        
        # Stream the response
        output_parts = []
        try:
            for chunk in stream_chat(
                prompt="",  # Already in messages
                conversation_history=messages[1:],  # Exclude system from history
                system_prompt=self.config.system_prompt,
                model=self.config.model,
                temperature=self.config.temperature,
                max_tokens=self.config.max_budget_tokens,
            ):
                output_parts.append(chunk)
                yield {'type': 'message_delta', 'text': chunk}
        except ProviderError as e:
            offline_text = self._build_offline_response(
                prompt,
                matched_commands,
                matched_tools,
                denied_tools,
                str(e),
            )
            yield {'type': 'message_delta', 'text': offline_text}
            output_parts.append(offline_text)
        
        output = ''.join(output_parts)
        projected_usage = self.total_usage.add_turn(prompt, output)
        
        self.mutable_messages.append(prompt)
        self.transcript_store.append(prompt)
        self.permission_denials.extend(denied_tools)
        self.total_usage = projected_usage
        
        yield {
            'type': 'message_stop',
            'usage': {'input_tokens': projected_usage.input_tokens, 'output_tokens': projected_usage.output_tokens},
            'stop_reason': 'completed',
            'transcript_size': len(self.transcript_store.entries),
        }

    def compact_messages_if_needed(self) -> None:
        if len(self.mutable_messages) > self.config.compact_after_turns:
            self.mutable_messages[:] = self.mutable_messages[-self.config.compact_after_turns :]
        self.transcript_store.compact(self.config.compact_after_turns)

    def replay_user_messages(self) -> tuple[str, ...]:
        return self.transcript_store.replay()

    def flush_transcript(self) -> None:
        self.transcript_store.flush()

    def persist_session(self) -> str:
        self.flush_transcript()
        path = save_session(
            StoredSession(
                session_id=self.session_id,
                messages=tuple(self.mutable_messages),
                input_tokens=self.total_usage.input_tokens,
                output_tokens=self.total_usage.output_tokens,
            )
        )
        return str(path)

    @staticmethod
    def _build_offline_response(
        prompt: str,
        matched_commands: tuple[str, ...],
        matched_tools: tuple[str, ...],
        denied_tools: tuple[PermissionDenial, ...],
        provider_error: str,
    ) -> str:
        lines = [
            'Prompt: ' + prompt,
            '',
            'Mode: offline fallback',
            'Reason: ' + provider_error,
            '',
            'Matched commands: ' + (', '.join(matched_commands) if matched_commands else 'none'),
            'Matched tools: ' + (', '.join(matched_tools) if matched_tools else 'none'),
            'Denied tools: ' + (', '.join(denial.tool_name for denial in denied_tools) if denied_tools else 'none'),
            '',
            'Provider unavailable or incompatible. Baba can still route commands, inspect mirrored tools, and show workspace metadata locally.',
        ]
        return '\n'.join(lines)

    def _format_output(self, summary_lines: list[str]) -> str:
        if self.config.structured_output:
            payload = {
                'summary': summary_lines,
                'session_id': self.session_id,
            }
            return self._render_structured_output(payload)
        return '\n'.join(summary_lines)

    def _render_structured_output(self, payload: dict[str, object]) -> str:
        last_error: Exception | None = None
        for _ in range(self.config.structured_retry_limit):
            try:
                return json.dumps(payload, indent=2)
            except (TypeError, ValueError) as exc:  # pragma: no cover - defensive branch
                last_error = exc
                payload = {'summary': ['structured output retry'], 'session_id': self.session_id}
        raise RuntimeError('structured output rendering failed') from last_error

    def render_summary(self) -> str:
        command_backlog = build_command_backlog()
        tool_backlog = build_tool_backlog()
        sections = [
            '# Python Porting Workspace Summary',
            '',
            self.manifest.to_markdown(),
            '',
            f'Command surface: {len(command_backlog.modules)} mirrored entries',
            *command_backlog.summary_lines()[:10],
            '',
            f'Tool surface: {len(tool_backlog.modules)} mirrored entries',
            *tool_backlog.summary_lines()[:10],
            '',
            f'Session id: {self.session_id}',
            f'Conversation turns stored: {len(self.mutable_messages)}',
            f'Permission denials tracked: {len(self.permission_denials)}',
            f'Usage totals: in={self.total_usage.input_tokens} out={self.total_usage.output_tokens}',
            f'Max turns: {self.config.max_turns}',
            f'Max budget tokens: {self.config.max_budget_tokens}',
            f'Transcript flushed: {self.transcript_store.flushed}',
        ]
        return '\n'.join(sections)
