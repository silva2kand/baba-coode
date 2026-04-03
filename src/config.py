"""Configuration module for Baba Code AI providers."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional


_DOTENV_LOADED = False


class ProviderType(Enum):
    """Supported AI provider types."""

    JAN = "jan"
    OLLAMA = "ollama"
    LM_STUDIO = "lm_studio"
    OPENAI = "openai"
    OPENROUTER = "openrouter"
    GROQ = "groq"
    GEMINI = "gemini"
    QWEN = "qwen"
    HUGGINGFACE = "huggingface"


LOCAL_PROVIDER_TYPES = (
    ProviderType.JAN,
    ProviderType.OLLAMA,
    ProviderType.LM_STUDIO,
)

CLOUD_PROVIDER_TYPES = (
    ProviderType.OPENAI,
    ProviderType.OPENROUTER,
    ProviderType.GROQ,
    ProviderType.GEMINI,
    ProviderType.QWEN,
    ProviderType.HUGGINGFACE,
)


PROVIDER_METADATA: dict[ProviderType, dict[str, str]] = {
    ProviderType.JAN: {
        "label": "Jan AI",
        "base_url": "http://localhost:1337/v1",
        "model": "local-model",
    },
    ProviderType.OLLAMA: {
        "label": "Ollama",
        "base_url": "http://localhost:11434/v1",
        "model": "llama3.2",
    },
    ProviderType.LM_STUDIO: {
        "label": "LM Studio",
        "base_url": "http://localhost:1234/v1",
        "model": "local-model",
    },
    ProviderType.OPENAI: {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4.1-mini",
    },
    ProviderType.OPENROUTER: {
        "label": "OpenRouter",
        "base_url": "https://openrouter.ai/api/v1",
        "model": "openai/gpt-4.1-mini",
    },
    ProviderType.GROQ: {
        "label": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "model": "llama-3.3-70b-versatile",
    },
    ProviderType.GEMINI: {
        "label": "Google Gemini",
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "model": "gemini-2.0-flash",
    },
    ProviderType.QWEN: {
        "label": "Qwen",
        "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
    ProviderType.HUGGINGFACE: {
        "label": "Hugging Face",
        "base_url": "https://router.huggingface.co/v1",
        "model": "meta-llama/Llama-3.1-8B-Instruct",
    },
}

DEFAULT_FALLBACK_ORDER = (
    ProviderType.JAN,
    ProviderType.OLLAMA,
    ProviderType.LM_STUDIO,
    ProviderType.OPENROUTER,
    ProviderType.GROQ,
    ProviderType.GEMINI,
    ProviderType.QWEN,
    ProviderType.HUGGINGFACE,
    ProviderType.OPENAI,
)


def _local_env_path() -> Path:
    candidate_paths = [
        Path.cwd() / ".env",
        Path(__file__).resolve().parent.parent / ".env",
    ]
    for env_path in candidate_paths:
        if env_path.exists() or env_path.parent.exists():
            return env_path
    return candidate_paths[-1]


def _read_env_map(env_path: Path | None = None) -> dict[str, str]:
    target_path = env_path or _local_env_path()
    if not target_path.exists():
        return {}

    result: dict[str, str] = {}
    for raw_line in target_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def _load_local_env() -> None:
    global _DOTENV_LOADED
    if _DOTENV_LOADED:
        return

    for key, value in _read_env_map().items():
        os.environ.setdefault(key, value)

    _DOTENV_LOADED = True


def _provider_prefix(provider_type: ProviderType) -> str:
    return provider_type.value.upper()


def supported_provider_types() -> tuple[ProviderType, ...]:
    return tuple(PROVIDER_METADATA.keys())


def get_enabled_provider_types(
    env_map: dict[str, str] | None = None,
) -> tuple[ProviderType, ...]:
    values = env_map or _read_env_map()
    configured = values.get(
        "BABA_ENABLED_PROVIDERS",
        os.getenv("BABA_ENABLED_PROVIDERS", ""),
    )
    if not configured.strip():
        return supported_provider_types()

    enabled: list[ProviderType] = []
    for part in configured.split(","):
        normalized = part.strip().lower()
        if not normalized:
            continue
        try:
            provider_type = ProviderType(normalized)
        except ValueError:
            continue
        if provider_type not in enabled:
            enabled.append(provider_type)

    return tuple(enabled) or supported_provider_types()


def provider_display_name(provider_type: ProviderType) -> str:
    return PROVIDER_METADATA[provider_type]["label"]


@dataclass(frozen=True)
class ProviderConfig:
    """Configuration for a single AI provider."""

    provider_type: ProviderType
    base_url: str
    api_key: str = "not-needed"
    model: str = ""
    timeout: int = 120
    max_retries: int = 3


def get_provider_config(
    provider_type: ProviderType,
    env_map: dict[str, str] | None = None,
) -> ProviderConfig:
    values = env_map or _read_env_map()
    metadata = PROVIDER_METADATA[provider_type]
    prefix = _provider_prefix(provider_type)
    api_key = values.get(
        f"{prefix}_API_KEY",
        os.getenv(f"{prefix}_API_KEY", "not-needed"),
    )
    if provider_type in {ProviderType.JAN, ProviderType.OLLAMA, ProviderType.LM_STUDIO}:
        api_key = api_key or "not-needed"

    return ProviderConfig(
        provider_type=provider_type,
        base_url=values.get(
            f"{prefix}_BASE_URL",
            os.getenv(f"{prefix}_BASE_URL", metadata["base_url"]),
        ),
        api_key=api_key or "not-needed",
        model=values.get(
            f"{prefix}_MODEL",
            os.getenv(f"{prefix}_MODEL", metadata["model"]),
        ),
    )


def save_provider_settings(
    provider_type: ProviderType,
    base_url: str,
    model: str,
    api_key: str = "",
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
    stream: bool | None = None,
    debug: bool | None = None,
    fallback_order: tuple[ProviderType, ...] | None = None,
    enabled_providers: tuple[ProviderType, ...] | None = None,
) -> "BabaConfig":
    env_path = _local_env_path()
    values = _read_env_map(env_path)
    prefix = _provider_prefix(provider_type)

    values["BABA_PRIMARY_PROVIDER"] = provider_type.value
    values[f"{prefix}_BASE_URL"] = base_url.strip()
    values[f"{prefix}_MODEL"] = model.strip()

    normalized_key = api_key.strip()
    if normalized_key:
        values[f"{prefix}_API_KEY"] = normalized_key
    elif provider_type in {ProviderType.JAN, ProviderType.OLLAMA, ProviderType.LM_STUDIO}:
        values[f"{prefix}_API_KEY"] = "not-needed"

    if max_tokens is not None:
        values["BABA_MAX_TOKENS"] = str(max_tokens)
    if temperature is not None:
        values["BABA_TEMPERATURE"] = str(temperature)
    if stream is not None:
        values["BABA_STREAM"] = "true" if stream else "false"
    if debug is not None:
        values["BABA_DEBUG"] = "true" if debug else "false"
    if fallback_order is not None:
        values["BABA_FALLBACK_ORDER"] = ",".join(
            provider.value for provider in fallback_order
        )
    if enabled_providers is not None:
        values["BABA_ENABLED_PROVIDERS"] = ",".join(
            provider.value for provider in enabled_providers
        )

    lines = [f"{key}={value}" for key, value in sorted(values.items())]
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    for key, value in values.items():
        os.environ[key] = value

    return reload_config()


def save_provider_profile(
    provider_type: ProviderType,
    base_url: str,
    model: str,
    api_key: str = "",
) -> "BabaConfig":
    env_path = _local_env_path()
    values = _read_env_map(env_path)
    prefix = _provider_prefix(provider_type)

    values[f"{prefix}_BASE_URL"] = base_url.strip()
    values[f"{prefix}_MODEL"] = model.strip()

    normalized_key = api_key.strip()
    if normalized_key:
        values[f"{prefix}_API_KEY"] = normalized_key
    elif provider_type in {ProviderType.JAN, ProviderType.OLLAMA, ProviderType.LM_STUDIO}:
        values[f"{prefix}_API_KEY"] = "not-needed"

    lines = [f"{key}={value}" for key, value in sorted(values.items())]
    env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    for key, value in values.items():
        os.environ[key] = value

    return reload_config()


def save_enabled_provider_types(
    enabled_providers: tuple[ProviderType, ...],
) -> "BabaConfig":
    current = get_config()
    current_order = [current.primary_provider.provider_type]
    current_order.extend(provider.provider_type for provider in current.fallback_providers)
    normalized_enabled = tuple(
        provider for provider in enabled_providers if provider in supported_provider_types()
    ) or LOCAL_PROVIDER_TYPES

    primary_type = current.primary_provider.provider_type
    if primary_type not in normalized_enabled:
        primary_type = normalized_enabled[0]

    fallback_order = tuple(
        provider for provider in current_order if provider != primary_type and provider in normalized_enabled
    )

    primary_config = get_provider_config(primary_type)
    return save_provider_settings(
        primary_type,
        primary_config.base_url,
        primary_config.model,
        "" if primary_config.api_key == "not-needed" else primary_config.api_key,
        fallback_order=fallback_order,
        enabled_providers=normalized_enabled,
    )


@dataclass
class BabaConfig:
    """Main configuration for Baba Code."""

    primary_provider: ProviderConfig
    fallback_providers: list[ProviderConfig] = field(default_factory=list)
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = True
    debug: bool = False

    @classmethod
    def from_env(cls) -> "BabaConfig":
        """Load configuration from environment variables."""

        _load_local_env()
        env_map = _read_env_map()

        primary_type_str = env_map.get(
            "BABA_PRIMARY_PROVIDER",
            os.getenv("BABA_PRIMARY_PROVIDER", "jan"),
        ).lower()
        primary_type = ProviderType(primary_type_str)
        enabled_types = get_enabled_provider_types(env_map)
        if primary_type not in enabled_types:
            local_enabled = [provider for provider in enabled_types if provider in LOCAL_PROVIDER_TYPES]
            primary_type = (local_enabled or list(enabled_types))[0]
        primary = get_provider_config(primary_type, env_map)

        configured_fallbacks = env_map.get("BABA_FALLBACK_ORDER", "")
        if configured_fallbacks.strip():
            fallback_order = [
                ProviderType(part.strip())
                for part in configured_fallbacks.split(",")
                if part.strip()
            ]
        else:
            fallback_order = list(DEFAULT_FALLBACK_ORDER)

        fallbacks: list[ProviderConfig] = []
        for fallback_type in fallback_order:
            if fallback_type == primary_type or fallback_type not in enabled_types:
                continue
            fallbacks.append(get_provider_config(fallback_type, env_map))

        return cls(
            primary_provider=primary,
            fallback_providers=fallbacks,
            max_tokens=int(
                env_map.get(
                    "BABA_MAX_TOKENS",
                    os.getenv("BABA_MAX_TOKENS", "4096"),
                )
            ),
            temperature=float(
                env_map.get(
                    "BABA_TEMPERATURE",
                    os.getenv("BABA_TEMPERATURE", "0.7"),
                )
            ),
            stream=env_map.get(
                "BABA_STREAM",
                os.getenv("BABA_STREAM", "true"),
            ).lower()
            == "true",
            debug=env_map.get(
                "BABA_DEBUG",
                os.getenv("BABA_DEBUG", "false"),
            ).lower()
            == "true",
        )

    @staticmethod
    def _get_default_url(provider_type: ProviderType) -> str:
        """Get default base URL for a provider type."""

        return PROVIDER_METADATA.get(
            provider_type,
            PROVIDER_METADATA[ProviderType.OLLAMA],
        )["base_url"]

    @staticmethod
    def _get_default_model(provider_type: ProviderType) -> str:
        """Get default model name for a provider type."""

        return PROVIDER_METADATA.get(
            provider_type,
            PROVIDER_METADATA[ProviderType.OLLAMA],
        )["model"]

    def get_all_providers(self) -> list[ProviderConfig]:
        """Get all providers in priority order (primary + fallbacks)."""

        return [self.primary_provider] + self.fallback_providers


_config: Optional[BabaConfig] = None


def get_config() -> BabaConfig:
    """Get the global configuration, loading from env if needed."""

    global _config
    if _config is None:
        _config = BabaConfig.from_env()
    return _config


def reload_config() -> BabaConfig:
    """Reload configuration from environment."""

    global _config
    _config = BabaConfig.from_env()
    return _config


BABA_HOME = Path(os.getenv("BABA_HOME", Path.home() / ".baba"))
BABA_CONFIG_FILE = BABA_HOME / "config.json"
BABA_SESSIONS_DIR = BABA_HOME / "sessions"
BABA_LOGS_DIR = BABA_HOME / "logs"


def ensure_baba_home() -> None:
    """Ensure Baba home directory exists."""

    BABA_HOME.mkdir(parents=True, exist_ok=True)
    BABA_SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    BABA_LOGS_DIR.mkdir(parents=True, exist_ok=True)
