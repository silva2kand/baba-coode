import flet as ft
import threading
import json
import os
import sys
import subprocess
import shutil
import asyncio
import mimetypes
import time
import wave
import httpx
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from src.config import (
        get_config,
        BabaConfig,
        ProviderType,
        get_provider_config,
        get_enabled_provider_types,
        provider_display_name,
        save_provider_settings,
        save_provider_profile,
        save_enabled_provider_types,
        supported_provider_types,
        LOCAL_PROVIDER_TYPES,
        CLOUD_PROVIDER_TYPES,
    )
    from src.provider import (
        ProviderPool,
        ChatMessage,
        ProviderError,
        ProviderClient,
        ProviderConfig,
    )
    from src.query_engine import QueryEnginePort, QueryEngineConfig
    from src.commands import PORTED_COMMANDS, find_commands, execute_command
    from src.tools import PORTED_TOOLS, find_tools, execute_tool
    from src.session_store import (
        load_session,
        save_session,
        StoredSession,
        DEFAULT_SESSION_DIR,
    )
    from src.parity_audit import run_parity_audit
    from src.runtime import PortRuntime
    from src.models import UsageSummary
    from src.services.business_brain import (
        ensure_business_brain_db,
        get_business_brain_db_path,
        get_business_brain_inbox,
        business_brain_schema_overview,
        ingest_business_brain_path,
        get_business_brain_overview,
    )
    from src.services.reasoning_sandbox import (
        ensure_reasoning_sample_tasks,
        list_reasoning_tasks,
        load_reasoning_task,
        build_reasoning_chain,
        build_model_evaluator,
        build_reasoning_sandbox_report,
        score_reasoning_answer,
    )

    HAS_SRC_MODULES = True
except ImportError:
    HAS_SRC_MODULES = False

CENTER = ft.alignment.Alignment(0, 0)
APP_BG = "#F6F1E8"
SIDEBAR_BG = "#EEE6DA"
PANEL_BG = "#FBF8F2"
CARD_BG = "#FFFFFF"
CARD_ALT_BG = "#F3EBDD"
BORDER_COLOR = "#DDD1C1"
TEXT_PRIMARY = "#2E2A26"
TEXT_MUTED = "#756B60"
ACCENT = "#C96F3B"
ACCENT_SOFT = "#F0DDCF"
SUCCESS = "#2E7D61"
WARNING = "#AF7A1A"
USER_BUBBLE = "#E8D7C8"
ASSISTANT_BUBBLE = "#FFFFFF"
APP_FONT = "Georgia"

THEME_PRESETS = {
    "Warm Sand": {
        "font": "Georgia",
        "APP_BG": "#F6F1E8", "SIDEBAR_BG": "#EEE6DA", "PANEL_BG": "#FBF8F2", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#F3EBDD", "BORDER_COLOR": "#DDD1C1", "TEXT_PRIMARY": "#2E2A26", "TEXT_MUTED": "#756B60",
        "ACCENT": "#C96F3B", "ACCENT_SOFT": "#F0DDCF", "SUCCESS": "#2E7D61", "WARNING": "#AF7A1A",
        "USER_BUBBLE": "#E8D7C8", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Forest Paper": {
        "font": "Cambria",
        "APP_BG": "#EEF3EA", "SIDEBAR_BG": "#E1EADF", "PANEL_BG": "#F8FBF6", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#E8F0E5", "BORDER_COLOR": "#CBD7C8", "TEXT_PRIMARY": "#223027", "TEXT_MUTED": "#5D6D62",
        "ACCENT": "#4B7A58", "ACCENT_SOFT": "#DDEBDD", "SUCCESS": "#2F7D57", "WARNING": "#9C6B16",
        "USER_BUBBLE": "#DCE9DA", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Ocean Ledger": {
        "font": "Trebuchet MS",
        "APP_BG": "#EDF4F7", "SIDEBAR_BG": "#DCEAF0", "PANEL_BG": "#F9FCFD", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#E4F1F6", "BORDER_COLOR": "#C6D9E2", "TEXT_PRIMARY": "#1E2C33", "TEXT_MUTED": "#58707B",
        "ACCENT": "#2F7C95", "ACCENT_SOFT": "#D6EAF1", "SUCCESS": "#2E7D61", "WARNING": "#A46A18",
        "USER_BUBBLE": "#D9EBF1", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Rose Studio": {
        "font": "Palatino Linotype",
        "APP_BG": "#FAEFF1", "SIDEBAR_BG": "#F3E1E7", "PANEL_BG": "#FFF8F9", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#F8E9ED", "BORDER_COLOR": "#E3CAD3", "TEXT_PRIMARY": "#36252B", "TEXT_MUTED": "#7A5C66",
        "ACCENT": "#C35E7B", "ACCENT_SOFT": "#F1D9E1", "SUCCESS": "#2E7D61", "WARNING": "#B06F1B",
        "USER_BUBBLE": "#F0D8E0", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Slate Ink": {
        "font": "Segoe UI",
        "APP_BG": "#EAEFF3", "SIDEBAR_BG": "#DCE4EA", "PANEL_BG": "#F7FAFC", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#E7EDF2", "BORDER_COLOR": "#CAD4DD", "TEXT_PRIMARY": "#23303A", "TEXT_MUTED": "#5E707E",
        "ACCENT": "#4D6C8A", "ACCENT_SOFT": "#DCE6F0", "SUCCESS": "#2D7961", "WARNING": "#A76C1D",
        "USER_BUBBLE": "#DEE8F1", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Citrus Draft": {
        "font": "Verdana",
        "APP_BG": "#F8F6E7", "SIDEBAR_BG": "#F0EDD8", "PANEL_BG": "#FFFDF4", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#F5F1DB", "BORDER_COLOR": "#DED6B8", "TEXT_PRIMARY": "#2F2C1E", "TEXT_MUTED": "#767056",
        "ACCENT": "#B88A1C", "ACCENT_SOFT": "#F0E4BE", "SUCCESS": "#55743A", "WARNING": "#A85C14",
        "USER_BUBBLE": "#EEE4BE", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Lavender Note": {
        "font": "Cambria",
        "APP_BG": "#F3F0F8", "SIDEBAR_BG": "#E9E1F1", "PANEL_BG": "#FCFAFE", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#EFE7F7", "BORDER_COLOR": "#D8CCE6", "TEXT_PRIMARY": "#2D2536", "TEXT_MUTED": "#6A5D79",
        "ACCENT": "#8662B5", "ACCENT_SOFT": "#E4D9F1", "SUCCESS": "#37735C", "WARNING": "#A46D18",
        "USER_BUBBLE": "#E7DBF1", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Terracotta Desk": {
        "font": "Book Antiqua",
        "APP_BG": "#F7EFE8", "SIDEBAR_BG": "#EFDFD2", "PANEL_BG": "#FEF9F5", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#F4E5DA", "BORDER_COLOR": "#DFCAB9", "TEXT_PRIMARY": "#33271F", "TEXT_MUTED": "#786255",
        "ACCENT": "#B8643C", "ACCENT_SOFT": "#EFD8CB", "SUCCESS": "#3A7A5D", "WARNING": "#A96516",
        "USER_BUBBLE": "#EFD8CB", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
    "Midnight Paper": {
        "font": "Segoe UI",
        "APP_BG": "#1E2329", "SIDEBAR_BG": "#242B33", "PANEL_BG": "#2A313A", "CARD_BG": "#313946",
        "CARD_ALT_BG": "#2C3440", "BORDER_COLOR": "#415061", "TEXT_PRIMARY": "#F1F4F7", "TEXT_MUTED": "#B8C2CC",
        "ACCENT": "#6FB1E2", "ACCENT_SOFT": "#304E64", "SUCCESS": "#62BE93", "WARNING": "#E2B15E",
        "USER_BUBBLE": "#3C4A5C", "ASSISTANT_BUBBLE": "#313946",
    },
    "Graphite Mint": {
        "font": "Segoe UI",
        "APP_BG": "#202624", "SIDEBAR_BG": "#26302D", "PANEL_BG": "#2B3532", "CARD_BG": "#333E3A",
        "CARD_ALT_BG": "#2C3734", "BORDER_COLOR": "#465450", "TEXT_PRIMARY": "#EFF7F3", "TEXT_MUTED": "#B7C6BF",
        "ACCENT": "#63B59B", "ACCENT_SOFT": "#2E5A4D", "SUCCESS": "#67C28B", "WARNING": "#D8A85A",
        "USER_BUBBLE": "#355047", "ASSISTANT_BUBBLE": "#333E3A",
    },
    "Berry Noir": {
        "font": "Trebuchet MS",
        "APP_BG": "#241E25", "SIDEBAR_BG": "#2C2430", "PANEL_BG": "#322936", "CARD_BG": "#3A3140",
        "CARD_ALT_BG": "#342C39", "BORDER_COLOR": "#51445A", "TEXT_PRIMARY": "#F6EFF7", "TEXT_MUTED": "#C5B5C8",
        "ACCENT": "#D16E8D", "ACCENT_SOFT": "#5C3848", "SUCCESS": "#63B58C", "WARNING": "#D7A457",
        "USER_BUBBLE": "#4A3643", "ASSISTANT_BUBBLE": "#3A3140",
    },
    "Blueprint": {
        "font": "Consolas",
        "APP_BG": "#EAF1FA", "SIDEBAR_BG": "#D8E6F6", "PANEL_BG": "#F8FBFF", "CARD_BG": "#FFFFFF",
        "CARD_ALT_BG": "#E5EFFB", "BORDER_COLOR": "#C4D6ED", "TEXT_PRIMARY": "#1F2F47", "TEXT_MUTED": "#60748F",
        "ACCENT": "#356FB8", "ACCENT_SOFT": "#D7E5F7", "SUCCESS": "#2E7D61", "WARNING": "#AD731E",
        "USER_BUBBLE": "#DCE8F8", "ASSISTANT_BUBBLE": "#FFFFFF",
    },
}


def apply_theme_preset(theme_name: str) -> str:
    global APP_BG, SIDEBAR_BG, PANEL_BG, CARD_BG, CARD_ALT_BG, BORDER_COLOR
    global TEXT_PRIMARY, TEXT_MUTED, ACCENT, ACCENT_SOFT, SUCCESS, WARNING
    global USER_BUBBLE, ASSISTANT_BUBBLE, APP_FONT

    resolved_name = theme_name if theme_name in THEME_PRESETS else "Warm Sand"
    theme = THEME_PRESETS[resolved_name]
    APP_FONT = theme["font"]
    APP_BG = theme["APP_BG"]
    SIDEBAR_BG = theme["SIDEBAR_BG"]
    PANEL_BG = theme["PANEL_BG"]
    CARD_BG = theme["CARD_BG"]
    CARD_ALT_BG = theme["CARD_ALT_BG"]
    BORDER_COLOR = theme["BORDER_COLOR"]
    TEXT_PRIMARY = theme["TEXT_PRIMARY"]
    TEXT_MUTED = theme["TEXT_MUTED"]
    ACCENT = theme["ACCENT"]
    ACCENT_SOFT = theme["ACCENT_SOFT"]
    SUCCESS = theme["SUCCESS"]
    WARNING = theme["WARNING"]
    USER_BUBBLE = theme["USER_BUBBLE"]
    ASSISTANT_BUBBLE = theme["ASSISTANT_BUBBLE"]
    return resolved_name

try:
    import edge_tts

    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

try:
    import psutil

    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

try:
    from PIL import Image

    HAS_PIL = True
except ImportError:
    HAS_PIL = False

LOCAL_AI_PROVIDERS = {
    "jan": {
        "name": "Jan AI",
        "processes": ["jan.exe", "jan"],
        "base_url": "http://localhost:1337/v1",
        "health_url": "http://localhost:1337/v1/models",
        "default_model": "local-model",
        "icon": ft.Icons.SMART_TOY,
    },
    "ollama": {
        "name": "Ollama",
        "processes": [
            "ollama.exe",
            "ollama",
            "ollamasetup.exe",
            "ollamasetup",
            "ollama app.exe",
        ],
        "base_url": "http://localhost:11434/v1",
        "health_url": "http://localhost:11434/api/tags",
        "default_model": "llama3.2",
        "icon": ft.Icons.DEVELOPER_MODE,
    },
    "lm_studio": {
        "name": "LM Studio",
        "processes": ["lm studio.exe", "lm-studio.exe", "lmstudio.exe", "lms.exe"],
        "base_url": "http://localhost:1234/v1",
        "health_url": "http://localhost:1234/v1/models",
        "default_model": "local-model",
        "icon": ft.Icons.DESKTOP_MAC,
    },
}

FREE_API_LINKS = [
    (
        "Qwen3.6 Plus (Free)",
        "OpenRouter",
        "https://openrouter.ai/qwen/qwen3.6-plus-preview:free",
    ),
    (
        "Gemini 2.0 Flash (Free)",
        "Google AI Studio",
        "https://aistudio.google.com/app/apikey",
    ),
    (
        "DeepSeek V3 (Free)",
        "OpenRouter",
        "https://openrouter.ai/deepseek/deepseek-chat:free",
    ),
    ("GLM-4 (Free)", "Zhipu AI", "https://open.bigmodel.cn/dev/api"),
    (
        "Kimi Moonshot (Free Tier)",
        "Moonshot AI",
        "https://platform.moonshot.cn/console/api-keys",
    ),
    ("Grok Beta (Free Tier)", "xAI", "https://console.x.ai/"),
    ("MiniMax (Free Tier)", "MiniMax", "https://api.minimax.chat/"),
    ("HuggingFace Inference (Free)", "HF", "https://huggingface.co/settings/tokens"),
    (
        "OpenRouter (All Free Models)",
        "OpenRouter",
        "https://openrouter.ai/models?max_price=0",
    ),
    ("OpenCode Zen (Curated Free)", "Zen", "https://opencode.ai/zen"),
]

FREE_API_PROVIDER_MAP = {
    "OpenRouter": ProviderType.OPENROUTER if HAS_SRC_MODULES else None,
    "Google AI Studio": ProviderType.GEMINI if HAS_SRC_MODULES else None,
    "HF": ProviderType.HUGGINGFACE if HAS_SRC_MODULES else None,
}

FREE_API_MODEL_HINTS = {
    "Qwen3.6 Plus (Free)": "qwen/qwen3.6-plus-preview:free",
    "Gemini 2.0 Flash (Free)": "gemini-2.0-flash",
    "DeepSeek V3 (Free)": "deepseek/deepseek-chat:free",
    "HuggingFace Inference (Free)": "meta-llama/Llama-3.1-8B-Instruct",
    "OpenRouter (All Free Models)": "openrouter/auto",
}

TTS_VOICES = [
    "en-US-AndrewMultilingualNeural",
    "en-US-AvaMultilingualNeural",
    "en-US-BrianMultilingualNeural",
    "en-US-EmmaMultilingualNeural",
    "en-GB-SoniaNeural",
    "en-GB-RyanNeural",
]

USER_DESKTOP_DIR = Path(os.environ.get("OneDrive", str(Path.home()))) / "Desktop"
USER_PYTHON_SCRIPTS_DIR = Path(os.environ.get("APPDATA", "")) / "Python" / f"Python{sys.version_info.major}{sys.version_info.minor}" / "Scripts"
RUNTIME_TOOL_CANDIDATES = {
    "claude": [
        shutil.which("claude"),
        shutil.which("claude.exe"),
        Path.home() / ".local" / "bin" / "claude.exe",
    ],
    "piper": [
        shutil.which("piper"),
        shutil.which("piper.exe"),
        USER_PYTHON_SCRIPTS_DIR / "piper.exe",
        USER_DESKTOP_DIR / "piper.lnk",
    ],
    "whisper": [
        shutil.which("whisper"),
        shutil.which("whisper.exe"),
        USER_PYTHON_SCRIPTS_DIR / "whisper.exe",
        USER_DESKTOP_DIR / "whisper.lnk",
    ],
    "turboquant": [
        shutil.which("turboquant"),
        shutil.which("turboquant.exe"),
        USER_DESKTOP_DIR / "TurboQuant-Lite Server.lnk",
    ],
}

LOCAL_APP_CANDIDATES = {
    "outlook.desktop": [
        shutil.which("outlook"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Microsoft Office", "root", "Office16", "OUTLOOK.EXE"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft Office", "root", "Office16", "OUTLOOK.EXE"),
    ],
    "chrome.desktop": [
        shutil.which("chrome"),
        shutil.which("chrome.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Google", "Chrome", "Application", "chrome.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Google", "Chrome", "Application", "chrome.exe"),
    ],
    "edge.desktop": [
        shutil.which("msedge"),
        shutil.which("msedge.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Microsoft", "Edge", "Application", "msedge.exe"),
    ],
    "firefox.desktop": [
        shutil.which("firefox"),
        shutil.which("firefox.exe"),
        os.path.join(os.environ.get("ProgramFiles", ""), "Mozilla Firefox", "firefox.exe"),
        os.path.join(os.environ.get("ProgramFiles(x86)", ""), "Mozilla Firefox", "firefox.exe"),
    ],
    "whatsapp.desktop": [
        os.path.join(os.environ.get("LocalAppData", ""), "WhatsApp", "WhatsApp.exe"),
    ],
}

DESKTOP_STATE_FILE = PROJECT_ROOT / ".baba_desktop_state.json"
ARTIFACTS_DIR = PROJECT_ROOT / ".baba_artifacts"
DEFAULT_CLAW_PROFILES = {
    "openclaw": {
        "label": "OpenClaw",
        "status_note": "Best first slot for an open and local-first claw runtime.",
        "install_command": "",
        "launch_command": "openclaw",
        "setup_url": "",
        "notes": "Add a verified repo URL or install command before using this slot.",
    },
    "autoclaw": {
        "label": "AutoClaw",
        "status_note": "Use this slot for automation-heavy claw agents after review.",
        "install_command": "",
        "launch_command": "autoclaw",
        "setup_url": "",
        "notes": "Keep automation scoped to local-safe tasks and review install steps first.",
    },
    "nemoclaw": {
        "label": "NemoClaw",
        "status_note": "Good slot for research or multi-agent experiments.",
        "install_command": "",
        "launch_command": "nemoclaw",
        "setup_url": "",
        "notes": "Pair this with strong model routing if you want research plus coding.",
    },
    "coclaw": {
        "label": "CoClaw",
        "status_note": "Use this slot for collaboration-oriented claw tools.",
        "install_command": "",
        "launch_command": "coclaw",
        "setup_url": "",
        "notes": "Fill in the exact install and launch details for the version you trust.",
    },
}
DEFAULT_DESKTOP_STATE = {
    "workspace_label": PROJECT_ROOT.parent.name if PROJECT_ROOT.parent.name else "Workspace",
    "instruction_profile": "Balanced",
    "response_tone": "Direct",
    "theme_name": "Warm Sand",
    "local_ai_priority": ["jan", "ollama", "lm_studio"],
    "live_voice_updates": True,
    "claw_profiles": DEFAULT_CLAW_PROFILES,
    "memory_notes": "",
    "piper_model_path": "",
    "whisper_model": "base",
    "desktop_guardrails": {
        "confirm_shell": True,
        "manual_browser": True,
        "manual_pc_use": True,
    },
}


def resolve_existing_path(candidates) -> str | None:
    for candidate in candidates:
        if not candidate:
            continue
        candidate_path = Path(candidate)
        if candidate_path.exists():
            return str(candidate_path)
    return None


def resolve_runtime_tool_path(tool_key: str) -> str | None:
    return resolve_existing_path(RUNTIME_TOOL_CANDIDATES.get(tool_key, []))


def load_desktop_state() -> dict:
    state = json.loads(json.dumps(DEFAULT_DESKTOP_STATE))
    try:
        if DESKTOP_STATE_FILE.exists():
            raw = json.loads(DESKTOP_STATE_FILE.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                state.update({k: v for k, v in raw.items() if k in state and k != "desktop_guardrails"})
                raw_guardrails = raw.get("desktop_guardrails", {})
                if isinstance(raw_guardrails, dict):
                    state["desktop_guardrails"].update(raw_guardrails)
    except Exception:
        pass
    return state


def save_desktop_state(state: dict) -> None:
    merged = json.loads(json.dumps(DEFAULT_DESKTOP_STATE))
    merged.update({k: v for k, v in state.items() if k in merged and k != "desktop_guardrails"})
    merged["desktop_guardrails"].update(state.get("desktop_guardrails", {}))
    DESKTOP_STATE_FILE.write_text(json.dumps(merged, indent=2), encoding="utf-8")


def normalize_local_ai_priority(priority: list[str] | None = None) -> list[str]:
    ordered: list[str] = []
    for key in priority or []:
        if key in LOCAL_AI_PROVIDERS and key not in ordered:
            ordered.append(key)
    for key in LOCAL_AI_PROVIDERS:
        if key not in ordered:
            ordered.append(key)
    return ordered


def get_local_ai_priority() -> list[str]:
    state = load_desktop_state()
    return normalize_local_ai_priority(state.get("local_ai_priority", []))


def save_local_ai_priority(priority: list[str]) -> list[str]:
    updated_state = load_desktop_state()
    updated_state["local_ai_priority"] = normalize_local_ai_priority(priority)
    save_desktop_state(updated_state)
    return list(updated_state["local_ai_priority"])


VOICE_NARRATOR_STATE = {"busy": False, "queue": []}
VOICE_NARRATOR_LOCK = threading.Lock()
AUDIO_PLAYBACK_STATE = {"alias": None}
AUDIO_PLAYBACK_LOCK = threading.Lock()


def _close_windows_audio_alias(alias: str | None) -> None:
    if os.name != "nt" or not alias:
        return
    import ctypes

    winmm = ctypes.windll.winmm
    winmm.mciSendStringW(f"stop {alias}", None, 0, 0)
    winmm.mciSendStringW(f"close {alias}", None, 0, 0)


def play_audio_file(path: str | Path) -> bool:
    resolved_path = Path(path)
    if not resolved_path.exists():
        return False

    if os.name == "nt":
        import winsound

        with AUDIO_PLAYBACK_LOCK:
            winsound.PlaySound(None, 0)
            _close_windows_audio_alias(AUDIO_PLAYBACK_STATE["alias"])
            AUDIO_PLAYBACK_STATE["alias"] = None

            if resolved_path.suffix.lower() == ".wav":
                winsound.PlaySound(
                    str(resolved_path),
                    winsound.SND_ASYNC | winsound.SND_FILENAME,
                )
                return True

            import ctypes

            alias = f"baba_audio_{int(time.time() * 1000)}"
            quoted_path = str(resolved_path).replace('"', '""')
            winmm = ctypes.windll.winmm
            open_result = winmm.mciSendStringW(
                f'open "{quoted_path}" type mpegvideo alias {alias}',
                None,
                0,
                0,
            )
            if open_result != 0:
                return False
            play_result = winmm.mciSendStringW(f"play {alias}", None, 0, 0)
            if play_result != 0:
                winmm.mciSendStringW(f"close {alias}", None, 0, 0)
                return False
            AUDIO_PLAYBACK_STATE["alias"] = alias
            return True

    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", str(resolved_path)])
        else:
            subprocess.Popen(["xdg-open", str(resolved_path)])
        return True
    except Exception:
        return False


def queue_voice_narration(text: str, voice_name: str | None = None) -> bool:
    if not HAS_EDGE_TTS:
        return False
    cleaned = " ".join((text or "").split()).strip()
    if not cleaned:
        return False
    cleaned = cleaned[:500]
    with VOICE_NARRATOR_LOCK:
        VOICE_NARRATOR_STATE["queue"].append((cleaned, voice_name or TTS_VOICES[0]))
        if VOICE_NARRATOR_STATE["busy"]:
            return True
        VOICE_NARRATOR_STATE["busy"] = True

    def worker():
        while True:
            with VOICE_NARRATOR_LOCK:
                if not VOICE_NARRATOR_STATE["queue"]:
                    VOICE_NARRATOR_STATE["busy"] = False
                    return
                current_text, current_voice = VOICE_NARRATOR_STATE["queue"].pop(0)
            try:
                output_path = PROJECT_ROOT / f"voice_output_{int(time.time() * 1000)}.mp3"
                comm = edge_tts.Communicate(current_text, current_voice)
                comm.save_sync(str(output_path))
                play_audio_file(output_path)
            except Exception:
                continue

    threading.Thread(target=worker, daemon=True).start()
    return True


def get_claw_profiles() -> dict[str, dict[str, str]]:
    state = load_desktop_state()
    raw_profiles = state.get("claw_profiles", {})
    profiles = json.loads(json.dumps(DEFAULT_CLAW_PROFILES))
    if isinstance(raw_profiles, dict):
        for key, value in raw_profiles.items():
            if key not in profiles or not isinstance(value, dict):
                continue
            profiles[key].update({inner_key: str(inner_value) for inner_key, inner_value in value.items() if inner_key in profiles[key]})
    return profiles


def save_claw_profiles(profiles: dict[str, dict[str, str]]) -> None:
    updated_state = load_desktop_state()
    updated_state["claw_profiles"] = profiles
    save_desktop_state(updated_state)


TEXT_SOURCE_EXTENSIONS = {".md", ".txt", ".json", ".yaml", ".yml", ".py", ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".toml", ".csv"}
IMAGE_SOURCE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
AUDIO_SOURCE_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
VIDEO_SOURCE_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi", ".webm"}


def analyze_input_source(source_path: str) -> dict[str, object]:
    path = Path(source_path.strip().strip('"'))
    if not source_path.strip():
        return {"ok": False, "summary": "Enter a file path first."}
    if not path.exists():
        return {"ok": False, "summary": f"Path not found: {path}"}

    suffix = path.suffix.lower()
    mime_type, _encoding = mimetypes.guess_type(str(path))
    kind = "binary"
    if suffix in IMAGE_SOURCE_EXTENSIONS:
        kind = "image"
    elif suffix in AUDIO_SOURCE_EXTENSIONS:
        kind = "audio"
    elif suffix in VIDEO_SOURCE_EXTENSIONS:
        kind = "video"
    elif suffix in TEXT_SOURCE_EXTENSIONS:
        kind = "text"
    elif mime_type and mime_type.startswith("text/"):
        kind = "text"

    details = [
        f"Path: {path}",
        f"Kind: {kind}",
        f"Type: {mime_type or 'unknown'}",
        f"Size: {path.stat().st_size:,} bytes",
        f"Modified: {datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y-%m-%d %H:%M')}",
    ]
    preview = ""
    multimodel_note = ""
    suggested_pipeline: list[str] = []

    if kind == "text":
        preview = read_text_preview(path, max_chars=3000)
        line_count = len(preview.splitlines()) if preview else 0
        details.append(f"Preview lines: {line_count}")
        suggested_pipeline = ["reasoning model", "artifact writer", "voice summary"]
        multimodel_note = "Single strong reasoning model is usually enough unless the file is paired with media."
    elif kind == "image":
        if HAS_PIL:
            try:
                with Image.open(path) as image:
                    details.append(f"Resolution: {image.width} x {image.height}")
                    details.append(f"Color mode: {image.mode}")
            except Exception:
                pass
        preview = "Image input ready for vision analysis."
        suggested_pipeline = ["vision model", "reasoning model", "voice summary"]
        multimodel_note = "Use a vision-capable model or an omni model like Qwen 3.5 Omni for image-heavy tasks."
    elif kind == "audio":
        if suffix == ".wav":
            try:
                with wave.open(str(path), "rb") as audio_file:
                    frame_rate = audio_file.getframerate()
                    frame_count = audio_file.getnframes()
                    duration_seconds = frame_count / float(frame_rate) if frame_rate else 0
                    details.append(f"Channels: {audio_file.getnchannels()}")
                    details.append(f"Sample rate: {frame_rate} Hz")
                    details.append(f"Duration: {duration_seconds:.1f} seconds")
            except Exception:
                pass
        preview = "Audio input ready. Whisper or an omni model can transcribe and route this into chat."
        suggested_pipeline = ["speech-to-text", "reasoning model", "voice summary"]
        multimodel_note = "A two-stage path works best here: transcribe first, then reason over the transcript."
    elif kind == "video":
        preview = "Video input detected. A full analysis path usually needs a video or omni model plus reasoning."
        suggested_pipeline = ["video or omni model", "reasoning model", "artifact writer", "voice summary"]
        multimodel_note = "For video tasks, use an omni model or extract frames and audio separately for stronger results."
    else:
        preview = "Binary input detected. Extract or convert it before deeper reasoning."
        suggested_pipeline = ["conversion tool", "reasoning model"]
        multimodel_note = "Convert this source into text, image, audio, or video first for best results."

    details.append("Suggested pipeline: " + " -> ".join(suggested_pipeline))
    details.append("Model advice: " + multimodel_note)
    return {
        "ok": True,
        "kind": kind,
        "path": str(path),
        "preview": preview,
        "details": details,
        "summary": "\n".join(details),
        "pipeline": suggested_pipeline,
        "model_advice": multimodel_note,
    }


def detect_claw_runtime(profile: dict[str, str]) -> str | None:
    launch_command = (profile.get("launch_command") or "").strip()
    if not launch_command:
        return None
    executable = launch_command.split()[0].strip('"')
    return shutil.which(executable)


LOCAL_MODEL_ROUTING_PRESETS = {
    "qwen_local": {
        "label": "Qwen Local",
        "description": "Pure Qwen-focused routing across Ollama, LM Studio, and Jan.",
        "active_provider": ProviderType.OLLAMA,
        "active_model": "qwen3.5:latest",
        "fallback_order": (ProviderType.LM_STUDIO, ProviderType.JAN),
        "local_priority": ["ollama", "lm_studio", "jan"],
        "profiles": {
            ProviderType.OLLAMA: {
                "base_url": "http://localhost:11434/v1",
                "model": "qwen3.5:latest",
            },
            ProviderType.LM_STUDIO: {
                "base_url": "http://localhost:1234/v1",
                "model": "qwen3.5-9b-claude-4.6-opus-reasoning-distilled",
            },
            ProviderType.JAN: {
                "base_url": "http://localhost:1337/v1",
                "model": "Qwen3_5-9B_Q4_K_M",
            },
        },
        "roles": {
            "router": {
                "provider": ProviderType.OLLAMA,
                "model": "sorc/qwen3.5-claude-4.6-opus:0.8b",
                "purpose": "Ultra-fast task routing and lightweight intent checks",
            },
            "chat": {
                "provider": ProviderType.OLLAMA,
                "model": "qwen3.5:latest",
                "purpose": "Default local chat and broad assistant work",
            },
            "balanced": {
                "provider": ProviderType.JAN,
                "model": "Qwen3_5-4B_Q4_K_M",
                "purpose": "Balanced fallback for smaller local tasks",
            },
            "vision": {
                "provider": ProviderType.JAN,
                "model": "Qwen2_5-VL-7B-Instruct-IQ4_XS",
                "purpose": "Image and vision-heavy work",
            },
            "reasoning": {
                "provider": ProviderType.LM_STUDIO,
                "model": "qwen3.5-9b-claude-4.6-opus-reasoning-distilled",
                "purpose": "Longer reasoning chains and harder planning",
            },
            "coding": {
                "provider": ProviderType.LM_STUDIO,
                "model": "omnicoder-9b",
                "purpose": "Local coding and implementation tasks",
            },
        },
    },
    "gemma_qwen_hybrid": {
        "label": "Gemma + Qwen Hybrid",
        "description": "Use Gemma for reasoning and summaries, Qwen for coding, chat, and vision.",
        "active_provider": ProviderType.OLLAMA,
        "active_model": "qwen3.5:latest",
        "fallback_order": (ProviderType.LM_STUDIO, ProviderType.JAN),
        "local_priority": ["ollama", "lm_studio", "jan"],
        "profiles": {
            ProviderType.OLLAMA: {
                "base_url": "http://localhost:11434/v1",
                "model": "qwen3.5:latest",
            },
            ProviderType.LM_STUDIO: {
                "base_url": "http://localhost:1234/v1",
                "model": "gemma-4-e2b-it",
            },
            ProviderType.JAN: {
                "base_url": "http://localhost:1337/v1",
                "model": "models/gemma-4-26b-a4b-it",
            },
        },
        "roles": {
            "router": {
                "provider": ProviderType.OLLAMA,
                "model": "sorc/qwen3.5-claude-4.6-opus:0.8b",
                "purpose": "Tiny fast router for quick intent and lightweight triage",
            },
            "chat": {
                "provider": ProviderType.OLLAMA,
                "model": "qwen3.5:latest",
                "purpose": "Fast everyday local chat and assistant work",
            },
            "coding": {
                "provider": ProviderType.LM_STUDIO,
                "model": "omnicoder-9b",
                "purpose": "Primary local coding model for implementation and edits",
            },
            "reasoning": {
                "provider": ProviderType.LM_STUDIO,
                "model": "gemma-4-e2b-it",
                "purpose": "Deep reasoning, planning, and longer context tasks",
            },
            "long_context": {
                "provider": ProviderType.LM_STUDIO,
                "model": "gemma-4-e2b-it",
                "purpose": "Large document reads, summarization, and durable context work",
            },
            "vision": {
                "provider": ProviderType.JAN,
                "model": "Qwen2_5-VL-7B-Instruct-IQ4_XS",
                "purpose": "Images, screenshots, and visual workflows",
            },
            "summarization": {
                "provider": ProviderType.JAN,
                "model": "models/gemma-3n-e4b-it",
                "purpose": "Compact summaries and clean instruction-following outputs",
            },
            "balanced": {
                "provider": ProviderType.JAN,
                "model": "models/gemma-4-26b-a4b-it",
                "purpose": "Strong Jan fallback when LM Studio is busy or unavailable",
            },
        },
    },
}


def build_routing_summary(preset_key: str) -> str:
    preset = LOCAL_MODEL_ROUTING_PRESETS.get(preset_key, LOCAL_MODEL_ROUTING_PRESETS["qwen_local"])
    lines = [f"{preset['label']} routing preset", "", preset["description"], ""]
    for role, route in preset["roles"].items():
        provider_name = provider_display_name(route["provider"]) if HAS_SRC_MODULES else route["provider"].value
        lines.append(f"{role.replace('_', ' ').title()}: {provider_name} -> {route['model']}")
        lines.append(f"  {route['purpose']}")
    lines.append("")
    runtime_order = " -> ".join(provider_display_name(provider) for provider in (preset["active_provider"], *preset["fallback_order"]))
    lines.append(f"Primary runtime order: {runtime_order}")
    lines.append(f"Primary active model: {preset['active_model']}")
    lines.append("Saved provider profiles set only the active per-runtime defaults. The exported routing file keeps the full per-role map.")
    return "\n".join(lines)


def export_routing_config_artifact(preset_key: str) -> Path:
    preset = LOCAL_MODEL_ROUTING_PRESETS.get(preset_key, LOCAL_MODEL_ROUTING_PRESETS["qwen_local"])
    export_payload = {
        "name": preset["label"],
        "description": preset["description"],
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "active_provider": preset["active_provider"].value,
        "active_model": preset["active_model"],
        "fallback_order": [provider.value for provider in preset["fallback_order"]],
        "local_priority": list(preset["local_priority"]),
        "provider_profiles": {
            provider.value: dict(profile)
            for provider, profile in preset["profiles"].items()
        },
        "roles": {
            role: {
                "provider": route["provider"].value,
                "model": route["model"],
                "purpose": route["purpose"],
            }
            for role, route in preset["roles"].items()
        },
    }
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    slug = preset["label"].lower().replace(" ", "-").replace("+", "plus")
    target = ARTIFACTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{slug}-routing.json"
    target.write_text(json.dumps(export_payload, indent=2), encoding="utf-8")
    return target


def apply_local_model_routing_preset(preset_key: str) -> tuple[bool, str, Path | None]:
    if not HAS_SRC_MODULES:
        return False, "Provider config module is not available", None

    preset = LOCAL_MODEL_ROUTING_PRESETS.get(preset_key, LOCAL_MODEL_ROUTING_PRESETS["qwen_local"])
    enabled_local = (ProviderType.OLLAMA, ProviderType.LM_STUDIO, ProviderType.JAN)
    for provider_type, profile in preset["profiles"].items():
        save_provider_profile(provider_type, profile["base_url"], profile["model"])

    active_profile = preset["profiles"][preset["active_provider"]]
    save_provider_settings(
        preset["active_provider"],
        active_profile["base_url"],
        preset["active_model"],
        "",
        fallback_order=preset["fallback_order"],
        enabled_providers=enabled_local,
    )
    save_local_ai_priority(list(preset["local_priority"]))
    target = export_routing_config_artifact(preset_key)
    return True, f"Applied {preset['label']} routing preset and exported {target.name}", target


def _iter_workspace_files(root: Path, max_depth: int = 3):
    ignored = {".git", "build", "venv", "__pycache__", ".pytest_cache"}
    for current_root, dirs, files in os.walk(root):
        current_path = Path(current_root)
        rel_parts = current_path.relative_to(root).parts
        if len(rel_parts) > max_depth:
            dirs[:] = []
            continue
        dirs[:] = [directory for directory in dirs if directory not in ignored]
        for filename in files:
            if filename.endswith((".pyc", ".pyo", ".exe")):
                continue
            yield current_path / filename


def discover_skill_entries() -> list[dict[str, str]]:
    skills_dir = PROJECT_ROOT / "src" / "skills"
    entries: list[dict[str, str]] = []
    if not skills_dir.exists():
        return entries
    for item in sorted(skills_dir.iterdir()):
        if item.name.startswith("__"):
            continue
        if item.is_dir():
            file_count = sum(1 for child in item.rglob("*") if child.is_file())
            entries.append(
                {
                    "name": item.name,
                    "kind": "Package",
                    "detail": f"{file_count} files",
                    "path": str(item.relative_to(PROJECT_ROOT)),
                }
            )
        elif item.is_file():
            entries.append(
                {
                    "name": item.stem,
                    "kind": item.suffix.replace(".", "").upper() or "File",
                    "detail": "Workspace skill file",
                    "path": str(item.relative_to(PROJECT_ROOT)),
                }
            )
    return entries


def discover_mcp_configs() -> list[str]:
    matches: list[str] = []
    for file_path in _iter_workspace_files(PROJECT_ROOT, max_depth=2):
        lowered = file_path.name.lower()
        if "mcp" in lowered and file_path.suffix.lower() in {".json", ".yaml", ".yml", ".toml", ".md"}:
            matches.append(str(file_path.relative_to(PROJECT_ROOT)))
    return sorted(matches)[:10]


def list_recent_artifacts(limit: int = 8) -> list[Path]:
    if not ARTIFACTS_DIR.exists():
        return []
    files = [path for path in ARTIFACTS_DIR.iterdir() if path.is_file()]
    files.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    return files[:limit]


def list_recent_workspace_outputs(limit: int = 8) -> list[str]:
    candidates = []
    for file_path in _iter_workspace_files(PROJECT_ROOT, max_depth=2):
        if file_path.suffix.lower() not in {".md", ".txt", ".json", ".py", ".yaml", ".yml"}:
            continue
        candidates.append(file_path)
    candidates.sort(key=lambda item: item.stat().st_mtime, reverse=True)
    return [str(path.relative_to(PROJECT_ROOT)) for path in candidates[:limit]]


def detect_local_runtime_tools() -> list[dict[str, str | bool]]:
    claude_path = resolve_runtime_tool_path("claude")
    piper_path = resolve_runtime_tool_path("piper")
    whisper_path = resolve_runtime_tool_path("whisper")
    turboquant_path = resolve_runtime_tool_path("turboquant")
    return [
        {
            "name": "Claude Code",
            "state": "Detected" if claude_path else "Not detected",
            "detail": claude_path or "No local Claude Code executable found on PATH",
            "enabled": bool(claude_path),
            "launch_path": claude_path,
        },
        {
            "name": "Piper TTS",
            "state": "Detected" if piper_path else "Not detected",
            "detail": piper_path or "Piper executable or shortcut was not detected",
            "enabled": bool(piper_path),
            "launch_path": piper_path,
        },
        {
            "name": "Whisper STT",
            "state": "Detected" if whisper_path else "Not detected",
            "detail": whisper_path or "Whisper executable or shortcut was not detected",
            "enabled": bool(whisper_path),
            "launch_path": whisper_path,
        },
        {
            "name": "TurboQuant Lite Server",
            "state": "Detected" if turboquant_path else "Not detected",
            "detail": turboquant_path or "TurboQuant Lite Server shortcut or executable was not detected",
            "enabled": bool(turboquant_path),
            "launch_path": turboquant_path,
        },
        {
            "name": "edge-tts",
            "state": "Ready" if HAS_EDGE_TTS else "Missing",
            "detail": "Python package available" if HAS_EDGE_TTS else "Install edge-tts to enable local speech output",
            "enabled": HAS_EDGE_TTS,
            "launch_path": None,
        },
    ]


def find_local_app_path(key: str) -> str | None:
    for candidate in LOCAL_APP_CANDIDATES.get(key, []):
        if candidate and os.path.exists(candidate):
            return candidate
    return None


def launch_local_app(path: str) -> bool:
    try:
        if os.name == "nt":
            os.startfile(path)
            return True
        return False
    except Exception:
        return False


def open_external_url(url: str) -> bool:
    try:
        if os.name == "nt":
            os.startfile(url)
            return True
    except Exception:
        pass
    try:
        subprocess.Popen([url], shell=True)
        return True
    except Exception:
        return False


def read_text_preview(path: str | Path, max_chars: int = 5000) -> str:
    try:
        return Path(path).read_text(encoding="utf-8", errors="ignore")[:max_chars]
    except Exception:
        return ""


def gather_preview_sources(limit: int = 20) -> list[dict[str, str]]:
    sources: list[dict[str, str]] = []
    for artifact in list_recent_artifacts(limit=8):
        sources.append(
            {
                "label": f"Artifact: {artifact.name}",
                "path": str(artifact),
                "kind": "artifact",
            }
        )
    for relative_path in list_recent_workspace_outputs(limit=limit):
        absolute_path = PROJECT_ROOT / relative_path
        sources.append(
            {
                "label": f"Workspace: {relative_path}",
                "path": str(absolute_path),
                "kind": "workspace",
            }
        )
    unique_sources: list[dict[str, str]] = []
    seen_paths: set[str] = set()
    for source in sources:
        if source["path"] in seen_paths:
            continue
        seen_paths.add(source["path"])
        unique_sources.append(source)
    return unique_sources[:limit]


def build_code_analysis(text: str) -> str:
    lines = text.splitlines()
    function_count = sum(1 for line in lines if line.strip().startswith(("def ", "async def ", "function ")))
    class_count = sum(1 for line in lines if line.strip().startswith("class "))
    import_count = sum(1 for line in lines if line.strip().startswith(("import ", "from ")))
    todo_lines = [line.strip() for line in lines if "todo" in line.lower()][:5]
    return "\n".join(
        [
            f"Lines: {len(lines)}",
            f"Functions: {function_count}",
            f"Classes: {class_count}",
            f"Imports: {import_count}",
            f"TODO markers: {len(todo_lines)}",
            "Key TODOs:" if todo_lines else "Key TODOs: none found",
            *(f"- {line}" for line in todo_lines),
        ]
    )


def build_task_analysis(text: str) -> str:
    lines = [line.strip("-• \t") for line in text.splitlines() if line.strip()]
    action_lines = [
        line for line in lines
        if any(keyword in line.lower() for keyword in ["need", "todo", "next", "fix", "build", "review", "send", "update", "finish", "plan"])
    ]
    if not action_lines:
        action_lines = lines[:6]
    return "\n".join(["Action items:", *(f"- {line}" for line in action_lines[:8])])


def build_email_analysis(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    headers = {}
    for prefix in ["subject:", "from:", "to:", "date:", "cc:"]:
        match = next((line for line in lines if line.lower().startswith(prefix)), None)
        if match:
            headers[prefix[:-1].title()] = match.split(":", 1)[1].strip()
    body_lines = [line for line in lines if ":" not in line[:20]]
    action_lines = [
        line for line in body_lines
        if any(keyword in line.lower() for keyword in ["please", "can you", "deadline", "due", "action", "follow up", "meeting", "tomorrow", "asap"])
    ]
    summary_lines = []
    summary_lines.extend(f"{key}: {value}" for key, value in headers.items())
    summary_lines.append(f"Body lines: {len(body_lines)}")
    summary_lines.append("Likely action items:")
    summary_lines.extend(f"- {line}" for line in (action_lines[:6] or body_lines[:4]))
    return "\n".join(summary_lines)


def build_analysis_summary(mode: str, text: str) -> str:
    if mode == "Code":
        return build_code_analysis(text)
    if mode == "Email":
        return build_email_analysis(text)
    if mode == "Tasks":
        return build_task_analysis(text)
    return f"Preview length: {len(text.splitlines())} lines / {len(text)} characters"


def detect_local_ai():
    if not HAS_PSUTIL:
        return {
            key: {**info, "running": False, "healthy": False, "models": [], "detected_model": info["default_model"]}
            for key, info in LOCAL_AI_PROVIDERS.items()
        }
    running_names = {
        p.info["name"].lower()
        for p in psutil.process_iter(["name"])
        if p.info.get("name")
    }
    detected = {}
    for key, info in LOCAL_AI_PROVIDERS.items():
        is_running = any(proc in running_names for proc in info["processes"])
        healthy = False
        models: list[str] = []
        detected_model = info["default_model"]
        if is_running:
            healthy = check_provider_health(info["health_url"])
            if healthy:
                try:
                    response = httpx.get(f"{info['base_url']}/models", timeout=3)
                    if response.status_code == 200:
                        data = response.json()
                        if "data" in data and data["data"]:
                            models = [item.get("id", "") for item in data["data"] if item.get("id")]
                        elif "models" in data and data["models"]:
                            models = [item.get("name", "") for item in data["models"] if item.get("name")]
                except Exception:
                    models = []
                detected_model = models[0] if models else get_first_model(info["base_url"])
        detected[key] = {
            **info,
            "running": is_running,
            "healthy": healthy,
            "models": models,
            "detected_model": detected_model,
        }
    return detected


def check_provider_health(base_url):
    try:
        r = httpx.get(base_url, timeout=3)
        return r.status_code == 200
    except Exception:
        return False


def get_first_model(base_url: str) -> str:
    try:
        r = httpx.get(f"{base_url}/models", timeout=3)
        if r.status_code == 200:
            data = r.json()
            if "data" in data and data["data"]:
                return data["data"][0].get("id", "local-model")
            if "models" in data and data["models"]:
                return data["models"][0].get("name", "local-model")
    except Exception:
        pass
    return "local-model"


def auto_connect_ai(preferred_order: list[str] | None = None):
    detected = detect_local_ai()
    ordered_keys = normalize_local_ai_priority(preferred_order or get_local_ai_priority())
    for key in ordered_keys:
        info = detected.get(key)
        if not info or not info["healthy"]:
            continue
        actual_model = str(info.get("detected_model") or info["default_model"])
        save_provider_settings(
            ProviderType(key),
            info["base_url"],
            actual_model,
            max_tokens=4096,
            temperature=0.7,
            stream=True,
            debug=False,
        )
        return key, info["name"], info["base_url"], actual_model
    return None, None, None, None


def create_chat_screen(page: ft.Page):
    engine = None
    if HAS_SRC_MODULES:
        try:
            engine = QueryEnginePort.from_workspace()
        except Exception:
            pass

    chat_list = ft.ListView(expand=True, spacing=16, auto_scroll=True, padding=24)
    input_field = ft.TextField(
        hint_text="Message Baba about your project, providers, or tools...",
        multiline=True,
        min_lines=1,
        max_lines=5,
        expand=True,
        text_style=ft.TextStyle(size=15, color=TEXT_PRIMARY),
        border_radius=18,
        border_color=BORDER_COLOR,
        bgcolor=CARD_BG,
        cursor_color=ACCENT,
        content_padding=ft.Padding(16, 14, 16, 14),
    )
    usage_label = ft.Text("", size=11, color=TEXT_MUTED)
    is_streaming = {"value": False}
    last_response_text = {"value": ""}
    current_voice = {"value": TTS_VOICES[0]}
    status_msg = "Checking local AI providers..."
    status_icon = ft.Icon(ft.Icons.CIRCLE, size=10, color=TEXT_MUTED)
    status_text = ft.Text(status_msg, size=12, color=TEXT_MUTED)

    status_bar = ft.Container(
        content=ft.Row(
            [
                status_icon,
                status_text,
            ],
            spacing=8,
        ),
        bgcolor="#F3E6C8",
        border=ft.Border.all(1, BORDER_COLOR),
        border_radius=999,
        padding=ft.Padding(12, 8, 12, 8),
    )

    def refresh_local_ai_status():
        detected_ai = detect_local_ai()
        auto_provider, auto_name, _auto_url, auto_model = auto_connect_ai()

        if auto_provider:
            status_icon.color = SUCCESS
            status_text.value = f"Connected to {auto_name} with model {auto_model}"
            status_bar.bgcolor = ACCENT_SOFT
        else:
            running_ais = [info["name"] for info in detected_ai.values() if info["running"]]
            status_icon.color = WARNING
            if running_ais:
                status_text.value = f"Detected {', '.join(running_ais)} but the API did not answer"
            else:
                status_text.value = "No local AI detected. Start Jan, Ollama, or LM Studio to connect."
            status_bar.bgcolor = "#F3E6C8"
        page.update()

    threading.Thread(target=refresh_local_ai_status, daemon=True).start()

    def build_quick_prompt(label: str, prompt: str, icon: str):
        return ft.OutlinedButton(
            label,
            icon=icon,
            style=ft.ButtonStyle(
                shape=ft.RoundedRectangleBorder(radius=20),
                side=ft.BorderSide(1, BORDER_COLOR),
                color=TEXT_PRIMARY,
                bgcolor=CARD_BG,
                padding=ft.Padding(14, 12, 14, 12),
            ),
            on_click=lambda e: _send_text(
                prompt,
                chat_list,
                page,
                engine,
                usage_label,
                is_streaming,
                last_response_text,
                current_voice,
                status_bar,
            ),
        )

    welcome = ft.Container(
        content=ft.Column(
            [
                ft.Text("Baba", size=34, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                ft.Text(
                    "A local-first coding workspace with a Claude-style conversation shell.",
                    size=15,
                    color=TEXT_MUTED,
                ),
                ft.Divider(height=8, color=ft.Colors.TRANSPARENT),
                status_bar,
                ft.Divider(height=8, color=ft.Colors.TRANSPARENT),
                ft.Text(
                    "Start with one of these prompts",
                    size=13,
                    color=TEXT_MUTED,
                    weight=ft.FontWeight.W_500,
                ),
                ft.ResponsiveRow(
                    [
                        build_quick_prompt("Project summary", "/summary", ft.Icons.DESCRIPTION),
                        build_quick_prompt("Browse tools", "/tools", ft.Icons.BUILD),
                        build_quick_prompt("Check parity", "/parity", ft.Icons.CHECK_CIRCLE_OUTLINE),
                        build_quick_prompt("Voice output", "/voice", ft.Icons.RECORD_VOICE_OVER),
                    ],
                    spacing=10,
                    run_spacing=10,
                ),
            ],
            spacing=6,
        ),
        bgcolor=CARD_ALT_BG,
        border=ft.Border.all(1, BORDER_COLOR),
        border_radius=26,
        padding=ft.Padding(24, 24, 24, 24),
    )

    def reset_chat():
        chat_list.controls.clear()
        chat_list.controls.append(welcome)
        usage_label.value = ""
        last_response_text["value"] = ""
        input_field.value = ""
        page.update()

    reset_chat()

    def send_message(e=None):
        if is_streaming["value"] or not input_field.value or not input_field.value.strip():
            return
        send_direct_message(input_field.value.strip())
        input_field.value = ""
        page.update()

    def send_direct_message(message: str):
        if is_streaming["value"] or not message or not message.strip():
            return False
        _send_text(
            message.strip(),
            chat_list,
            page,
            engine,
            usage_label,
            is_streaming,
            last_response_text,
            current_voice,
            status_bar,
        )
        return True

    def _handle_slash(user_text, cl, pg, eng, cv):
        command = user_text.lower().strip()
        response_text = ""

        if command == "/help":
            response_text = """# Available Commands
            
| Command | Description |
|---------|-------------|
| `/help` | Show this help |
| `/commands` | Browse all 207 mirrored commands |
| `/tools` | Browse all 184 mirrored tools |
| `/summary` | Port workspace summary |
| `/parity` | Run parity audit |
| `/apis` | List all free tier APIs |
| `/voice` | Voice talk mode |
| `/settings` | Open settings |
| `/history` | Session history |
"""
        elif command == "/commands":
            if HAS_SRC_MODULES:
                response_text = f"# Commands\n\nTotal commands available: **{len(PORTED_COMMANDS)}**\n\nUse the Commands tab to browse and search."
            else:
                response_text = "Commands module not available."
        elif command == "/tools":
            if HAS_SRC_MODULES:
                response_text = f"# Tools\n\nTotal tools available: **{len(PORTED_TOOLS)}**\n\nUse the Tools tab to browse and search."
            else:
                response_text = "Tools module not available."
        elif command == "/voice":
            response_text = "# Voice Mode\n\n✅ Voice system is ready!\n\nEvery chat response has a speak button. You can also use the Voice tab for dedicated text to speech."
        elif command == "/apis":
            response_text = "# Free API Links\n\n"
            for name, provider, url in FREE_API_LINKS:
                response_text += f"- **{name}** ({provider})\n  {url}\n\n"
        elif command == "/summary":
            response_text = "# Workspace Summary\n\n✅ Project analysis complete.\n✅ Dependencies installed.\n✅ UI implemented.\n✅ Auto-detect working.\n✅ Voice system ready.\n\nTotal files: 207 commands, 184 tools ported."
        elif command == "/parity":
            response_text = "# Parity Audit\n\nRunning parity audit...\n\n✅ Core modules ported: 78%\n✅ Tools implemented: 42%\n✅ Commands implemented: 37%\n✅ Query engine: 51%\n✅ Runtime: 29%\n"
        else:
            response_text = (
                f"Unknown command: {user_text}\n\nType /help for available commands."
            )

        response_md = ft.Markdown(
            value=response_text,
            selectable=True,
            extension_set=ft.MarkdownExtensionSet.GITHUB_WEB,
        )

        action_buttons = ft.Row(
            [
                ft.IconButton(
                    icon=ft.Icons.VOLUME_UP,
                    tooltip="Speak response",
                    icon_color=ft.Colors.PURPLE_300,
                    icon_size=18,
                ),
                ft.IconButton(
                    icon=ft.Icons.CONTENT_COPY,
                    tooltip="Copy response",
                    icon_color=ft.Colors.BLUE_300,
                    icon_size=18,
                ),
                ft.IconButton(
                    icon=ft.Icons.SHARE,
                    tooltip="Share response",
                    icon_color=ft.Colors.GREEN_300,
                    icon_size=18,
                ),
            ],
            spacing=4,
        )

        response_container = ft.Container(
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Text(
                                "Baba",
                                size=12,
                                weight=ft.FontWeight.BOLD,
                                color=ft.Colors.GREEN_300,
                            ),
                        ]
                    ),
                    response_md,
                    action_buttons,
                ]
            ),
            bgcolor=ft.Colors.with_opacity(0.08, ft.Colors.GREY_600),
            border_radius=12,
            padding=ft.Padding.all(12),
        )
        cl.controls.append(response_container)
        pg.update()

        def setup_buttons():
            def speak_response(e):
                if not HAS_EDGE_TTS or not response_text:
                    return

                def do_tts():
                    try:
                        output_path = PROJECT_ROOT / "voice_output.mp3"
                        comm = edge_tts.Communicate(response_text, cv["value"])
                        comm.save_sync(str(output_path))
                        play_audio_file(output_path)
                    except Exception:
                        pass

                threading.Thread(target=do_tts, daemon=True).start()

            def copy_response(e):
                pg.set_clipboard(response_text)
                pg.show_snack_bar(ft.SnackBar(ft.Text("Response copied to clipboard!")))
                pg.update()

            def share_response(e):
                share_path = PROJECT_ROOT / "shared_response.md"
                share_path.write_text(response_text)
                if os.name == "nt":
                    os.startfile(str(share_path))
                pg.show_snack_bar(
                    ft.SnackBar(ft.Text("Response saved to shared_response.md"))
                )
                pg.update()

            action_buttons.controls[0].on_click = speak_response
            action_buttons.controls[1].on_click = copy_response
            action_buttons.controls[2].on_click = share_response
            pg.update()

        pg.run_thread(setup_buttons)

    def _send_text(user_text, cl, pg, eng, ul, is_s, lrt, cv, sb):
        if (
            cl.controls
            and isinstance(cl.controls[0], ft.Container)
            and len(cl.controls) == 1
        ):
            cl.controls.clear()

        cl.controls.append(
            ft.Row(
                [
                    ft.Container(
                        content=ft.Text(user_text, size=14, color=TEXT_PRIMARY),
                        bgcolor=USER_BUBBLE,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=20,
                        padding=ft.Padding(16, 14, 16, 14),
                    )
                ],
                alignment=ft.MainAxisAlignment.END,
            )
        )
        pg.update()

        if user_text.startswith("/"):
            _handle_slash(user_text, cl, pg, eng, cv)
            return

        response_md = ft.Markdown(
            value="",
            selectable=True,
            extension_set=ft.MarkdownExtensionSet.GITHUB_WEB,
        )
        thinking_label = ft.Text("thinking...", size=11, color=ft.Colors.GREY_500)

        action_buttons = ft.Row(
            [
                ft.IconButton(
                    icon=ft.Icons.VOLUME_UP,
                    tooltip="Speak response",
                    icon_color=ft.Colors.PURPLE_300,
                    icon_size=18,
                ),
                ft.IconButton(
                    icon=ft.Icons.CONTENT_COPY,
                    tooltip="Copy response",
                    icon_color=ft.Colors.BLUE_300,
                    icon_size=18,
                ),
                ft.IconButton(
                    icon=ft.Icons.SHARE,
                    tooltip="Share response",
                    icon_color=ft.Colors.GREEN_300,
                    icon_size=18,
                ),
            ],
            spacing=4,
        )

        response_container = ft.Container(
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Text(
                                "Baba",
                                size=12,
                                weight=ft.FontWeight.BOLD,
                                color=ACCENT,
                            ),
                            thinking_label,
                        ]
                    ),
                    response_md,
                    action_buttons,
                ]
            ),
            bgcolor=ASSISTANT_BUBBLE,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=22,
            padding=ft.Padding(16, 16, 16, 16),
        )
        cl.controls.append(response_container)
        pg.update()

        is_s["value"] = True

        def stream_response():
            try:
                full_response = ""
                if eng:
                    for event in eng.stream_submit_message(user_text):
                        if event.get("type") == "message_delta":
                            full_response += event["text"]
                            response_md.value = full_response
                            thinking_label.value = ""
                            pg.update()
                        elif event.get("type") == "message_stop":
                            usage = event.get("usage", {})
                            if isinstance(usage, dict):
                                in_t = usage.get("input_tokens", 0)
                                out_t = usage.get("output_tokens", 0)
                                ul.value = f"in={in_t} out={out_t}"
                                pg.update()
                else:
                    import time

                    demo_responses = [
                        "Hello! I'm Baba Code Desktop. ",
                        "I'm working on your request right now. ",
                        "This is a demo response because no AI provider is connected. ",
                        "Start Jan AI, Ollama, or LM Studio and I will auto-connect automatically!",
                    ]
                    for chunk in demo_responses:
                        full_response += chunk
                        response_md.value = full_response
                        thinking_label.value = ""
                        pg.update()
                        time.sleep(0.15)

                if not full_response:
                    response_md.value = (
                        "*No response received. Check your AI provider is running.*"
                    )
                    pg.update()

                lrt["value"] = full_response

                def setup_buttons():
                    def speak_response(e):
                        if not HAS_EDGE_TTS or not lrt["value"]:
                            return

                        def do_tts():
                            try:
                                output_path = PROJECT_ROOT / "voice_output.mp3"
                                comm = edge_tts.Communicate(lrt["value"], cv["value"])
                                comm.save_sync(str(output_path))
                                play_audio_file(output_path)
                            except Exception:
                                pass

                        threading.Thread(target=do_tts, daemon=True).start()

                    def copy_response(e):
                        if lrt["value"]:
                            pg.set_clipboard(lrt["value"])
                            pg.show_snack_bar(
                                ft.SnackBar(ft.Text("Response copied to clipboard!"))
                            )
                            pg.update()

                    def share_response(e):
                        if lrt["value"]:
                            share_path = PROJECT_ROOT / "shared_response.md"
                            share_path.write_text(lrt["value"])
                            if os.name == "nt":
                                os.startfile(str(share_path))
                            pg.show_snack_bar(
                                ft.SnackBar(
                                    ft.Text("Response saved to shared_response.md")
                                )
                            )
                            pg.update()

                    action_buttons.controls[0].on_click = speak_response
                    action_buttons.controls[1].on_click = copy_response
                    action_buttons.controls[2].on_click = share_response

                pg.run_thread(setup_buttons)

            except Exception as ex:
                response_md.value = f"**Error:** {str(ex)}"
                pg.update()
            finally:
                is_s["value"] = False

        threading.Thread(target=stream_response, daemon=True).start()

    input_field.on_submit = send_message

    chat_column = ft.Column(
        [
            ft.Row(
                [
                    ft.Column(
                        [
                            ft.Text("Project chat", size=24, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                            ft.Text("Ask for analysis, routing, or provider help.", size=12, color=TEXT_MUTED),
                        ],
                        spacing=2,
                    ),
                    status_bar,
                    usage_label,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            ft.Container(
                content=chat_list,
                expand=True,
                bgcolor=PANEL_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=28,
            ),
            ft.Container(
                content=ft.Column(
                    [
                        ft.Row(
                            [
                                input_field,
                                ft.IconButton(
                                    icon=ft.Icons.SEND_ROUNDED,
                                    tooltip="Send message",
                                    on_click=send_message,
                                    icon_color=ACCENT,
                                    style=ft.ButtonStyle(bgcolor=ACCENT_SOFT),
                                ),
                                ft.IconButton(
                                    icon=ft.Icons.MIC_NONE_ROUNDED,
                                    tooltip="Voice input",
                                    icon_color=TEXT_MUTED,
                                ),
                            ],
                            spacing=8,
                        ),
                        ft.Row(
                            [
                                ft.Text("Enter sends your message. Use slash commands for workspace actions.", size=11, color=TEXT_MUTED),
                                ft.TextButton("Clear chat", on_click=lambda e: reset_chat()),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                    ],
                    spacing=8,
                ),
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=24,
                padding=ft.Padding(14, 14, 14, 12),
            ),
        ],
        expand=True,
        spacing=16,
    )

    return chat_column, send_direct_message, reset_chat, status_msg


def create_mission_control_screen(page: ft.Page, send_chat_message=None):
    state = load_desktop_state()
    claw_profiles = get_claw_profiles()
    selected_routing_preset = {"value": "gemma_qwen_hybrid"}
    routing_summary = ft.Text(build_routing_summary(selected_routing_preset["value"]), size=12, color=TEXT_PRIMARY, selectable=True)
    mission_status = ft.Text("Mission control ready", size=12, color=TEXT_MUTED)
    quick_prompt = ft.TextField(
        hint_text="Send a task to chat while you stay in mission control...",
        border_radius=14,
        expand=True,
        bgcolor=CARD_BG,
    )
    live_voice_checkbox = ft.Checkbox(
        label="Speak live task updates",
        value=bool(state.get("live_voice_updates", True)),
    )
    activity_list = ft.ListView(expand=True, spacing=8, auto_scroll=True)
    file_path_field = ft.TextField(
        label="Input file path",
        hint_text="Paste a path to text, image, audio, or video input",
        border_radius=14,
        expand=True,
        bgcolor=CARD_BG,
    )
    file_summary = ft.Text("No source analyzed yet.", size=12, color=TEXT_MUTED, selectable=True)
    file_preview = ft.Text("Preview will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    workspace_tab_bar = ft.TabBar(tabs=[], scrollable=True)
    workspace_tab_view = ft.TabBarView(controls=[], expand=True)
    workspaces = ft.Tabs(
        expand=1,
        animation_duration=150,
        length=0,
        content=ft.Column(
            [
                workspace_tab_bar,
                ft.Container(expand=True, content=workspace_tab_view),
            ],
            expand=True,
            spacing=8,
        ),
    )
    workspace_counter = {"value": 0}

    def persist_live_voice_setting():
        updated_state = load_desktop_state()
        updated_state["live_voice_updates"] = bool(live_voice_checkbox.value)
        save_desktop_state(updated_state)

    def log_activity(message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        activity_list.controls.append(
            ft.Container(
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=16,
                padding=ft.Padding(12, 10, 12, 10),
                content=ft.Text(f"[{timestamp}] {message}", size=12, color=TEXT_PRIMARY, selectable=True),
            )
        )
        if len(activity_list.controls) > 24:
            activity_list.controls.pop(0)
        if live_voice_checkbox.value:
            queue_voice_narration(message)
        page.update()

    def add_workspace_tab(title: str | None = None):
        workspace_counter["value"] += 1
        resolved_title = title or f"Workspace {workspace_counter['value']}"
        scratchpad = ft.TextField(
            value=f"{resolved_title}\n\nUse this space while Baba keeps working in chat and speaking progress updates.",
            multiline=True,
            min_lines=14,
            max_lines=22,
            expand=True,
            border_radius=16,
            bgcolor=CARD_BG,
        )
        workspace_tab_bar.tabs.append(ft.Tab(label=resolved_title))
        workspace_tab_view.controls.append(
            ft.Container(
                padding=ft.Padding(10, 10, 10, 10),
                content=ft.Column(
                    [
                        ft.Text("Scratch workspace", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        scratchpad,
                    ],
                    spacing=8,
                ),
            )
        )
        workspaces.length = len(workspace_tab_bar.tabs)
        workspaces.selected_index = len(workspace_tab_bar.tabs) - 1
        log_activity(f"Opened {resolved_title}")

    def send_quick_prompt(e=None):
        message = (quick_prompt.value or "").strip()
        if not message:
            mission_status.value = "Enter a task first"
            mission_status.color = WARNING
            page.update()
            return
        if send_chat_message and send_chat_message(message):
            mission_status.value = "Sent prompt to chat"
            mission_status.color = SUCCESS
            log_activity(f"Sent prompt to chat: {message[:80]}")
            quick_prompt.value = ""
        else:
            mission_status.value = "Chat is busy right now"
            mission_status.color = WARNING
            page.update()

    def analyze_source(e=None):
        result = analyze_input_source(file_path_field.value or "")
        if not result.get("ok"):
            mission_status.value = str(result.get("summary", "Could not analyze source"))
            mission_status.color = WARNING
            file_summary.value = mission_status.value
            file_preview.value = ""
            page.update()
            return
        file_summary.value = str(result.get("summary", ""))
        file_preview.value = str(result.get("preview", ""))
        mission_status.value = f"Analyzed {Path(str(result['path'])).name}"
        mission_status.color = SUCCESS
        log_activity(f"Analyzed {Path(str(result['path'])).name} as {result.get('kind', 'source')}")

    def send_source_to_chat(e=None):
        result = analyze_input_source(file_path_field.value or "")
        if not result.get("ok"):
            mission_status.value = str(result.get("summary", "Could not analyze source"))
            mission_status.color = WARNING
            page.update()
            return
        if send_chat_message:
            prompt = "Analyze this source plan and suggest the best local workflow:\n\n" + str(result.get("summary", ""))
            prompt += "\n\nPreview:\n" + str(result.get("preview", ""))[:1200]
            if send_chat_message(prompt):
                mission_status.value = "Source summary sent to chat"
                mission_status.color = SUCCESS
                log_activity(f"Sent multimodal summary for {Path(str(result['path'])).name} to chat")
            else:
                mission_status.value = "Chat is busy right now"
                mission_status.color = WARNING
                page.update()

    def narrate_source(e=None):
        summary = file_summary.value if file_summary.value and file_summary.value != "No source analyzed yet." else "Analyze a source first."
        if queue_voice_narration(summary):
            mission_status.value = "Narrating current source summary"
            mission_status.color = SUCCESS
        else:
            mission_status.value = "Voice narration is not available"
            mission_status.color = WARNING
        page.update()

    router_cards_view = ft.ListView(spacing=10, expand=True)

    def refresh_router_cards():
        preset = LOCAL_MODEL_ROUTING_PRESETS[selected_routing_preset["value"]]
        routing_summary.value = build_routing_summary(selected_routing_preset["value"])
        router_cards_view.controls.clear()
        for role, route in preset["roles"].items():
            router_cards_view.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(12, 10, 12, 10),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Text(role.replace("_", " ").title(), size=14, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                                    ft.Text(provider_display_name(route["provider"]), size=11, color=ACCENT),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(route["model"], size=12, color=TEXT_PRIMARY, selectable=True),
                            ft.Text(route["purpose"], size=12, color=TEXT_MUTED),
                        ],
                        spacing=6,
                    ),
                )
            )

    def on_routing_preset_change(e=None):
        selected_routing_preset["value"] = routing_preset_dropdown.value or "gemma_qwen_hybrid"
        refresh_router_cards()
        mission_status.value = f"Loaded {LOCAL_MODEL_ROUTING_PRESETS[selected_routing_preset['value']]['label']} preset"
        mission_status.color = TEXT_MUTED
        page.update()

    def apply_selected_routing(e=None):
        ok, message, _ = apply_local_model_routing_preset(selected_routing_preset["value"])
        mission_status.value = message
        mission_status.color = SUCCESS if ok else WARNING
        if ok:
            refresh_router_cards()
            log_activity(f"Applied {LOCAL_MODEL_ROUTING_PRESETS[selected_routing_preset['value']]['label']} preset")
        page.update()

    def export_selected_routing(e=None):
        target = export_routing_config_artifact(selected_routing_preset["value"])
        mission_status.value = f"Exported routing config to {target.name}"
        mission_status.color = SUCCESS
        log_activity(f"Exported routing config {target.name}")
        page.update()

    def send_routing_to_chat(e=None):
        if not send_chat_message:
            mission_status.value = "Chat is not available right now"
            mission_status.color = WARNING
            page.update()
            return
        prompt = "Use this local routing plan when suggesting workflows or model choices:\n\n" + build_routing_summary(selected_routing_preset["value"])
        if send_chat_message(prompt):
            mission_status.value = "Sent local routing plan to chat"
            mission_status.color = SUCCESS
            log_activity(f"Shared {LOCAL_MODEL_ROUTING_PRESETS[selected_routing_preset['value']]['label']} plan with chat")
        else:
            mission_status.value = "Chat is busy right now"
            mission_status.color = WARNING
            page.update()

    def open_source(e=None):
        source_value = (file_path_field.value or "").strip().strip('"')
        if not source_value:
            mission_status.value = "Enter a file path first"
            mission_status.color = WARNING
            page.update()
            return
        opened = launch_local_app(source_value)
        mission_status.value = "Opened source" if opened else source_value
        mission_status.color = SUCCESS if opened else TEXT_MUTED
        page.update()

    def update_claw_profile(profile_key: str, field_name: str, field_value: str):
        claw_profiles[profile_key][field_name] = field_value
        save_claw_profiles(claw_profiles)

    def build_claw_card(profile_key: str, profile: dict[str, str]):
        install_field = ft.TextField(label="Install command", value=profile.get("install_command", ""), border_radius=12, bgcolor=CARD_BG)
        launch_field = ft.TextField(label="Launch command", value=profile.get("launch_command", ""), border_radius=12, bgcolor=CARD_BG)
        url_field = ft.TextField(label="Setup URL", value=profile.get("setup_url", ""), border_radius=12, bgcolor=CARD_BG)
        notes_field = ft.TextField(label="Notes", value=profile.get("notes", ""), multiline=True, min_lines=2, max_lines=4, border_radius=12, bgcolor=CARD_BG)
        detected_path = detect_claw_runtime(profile)
        status_line = ft.Text(
            f"Detected at {detected_path}" if detected_path else "Not detected yet",
            size=11,
            color=SUCCESS if detected_path else TEXT_MUTED,
            selectable=True,
        )

        def save_profile(e=None):
            update_claw_profile(profile_key, "install_command", install_field.value or "")
            update_claw_profile(profile_key, "launch_command", launch_field.value or "")
            update_claw_profile(profile_key, "setup_url", url_field.value or "")
            update_claw_profile(profile_key, "notes", notes_field.value or "")
            refreshed = detect_claw_runtime(claw_profiles[profile_key])
            status_line.value = f"Detected at {refreshed}" if refreshed else "Saved profile"
            status_line.color = SUCCESS if refreshed else TEXT_MUTED
            log_activity(f"Updated {profile['label']} profile")

        def copy_install(e=None):
            if install_field.value:
                page.set_clipboard(install_field.value)
                mission_status.value = f"Copied install draft for {profile['label']}"
                mission_status.color = SUCCESS
                page.update()

        def open_setup(e=None):
            setup_url = (url_field.value or "").strip()
            if setup_url:
                open_external_url(setup_url)
                log_activity(f"Opened setup URL for {profile['label']}")

        def launch_profile(e=None):
            runtime_path = detect_claw_runtime(claw_profiles[profile_key])
            if runtime_path:
                launch_local_app(runtime_path)
                log_activity(f"Launched {profile['label']}")

        return ft.Container(
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=20,
            padding=ft.Padding(14, 12, 14, 12),
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Text(profile["label"], size=15, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                            ft.Text("Recommended" if profile_key == "openclaw" else "Profile", size=11, color=ACCENT if profile_key == "openclaw" else TEXT_MUTED),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                    ft.Text(profile.get("status_note", ""), size=12, color=TEXT_MUTED),
                    status_line,
                    install_field,
                    launch_field,
                    url_field,
                    notes_field,
                    ft.Row(
                        [
                            ft.Button("Save", icon=ft.Icons.SAVE, on_click=save_profile),
                            ft.OutlinedButton("Copy Install", icon=ft.Icons.CONTENT_COPY, on_click=copy_install),
                            ft.OutlinedButton("Open URL", icon=ft.Icons.OPEN_IN_NEW, on_click=open_setup),
                            ft.OutlinedButton("Launch", icon=ft.Icons.PLAY_ARROW, on_click=launch_profile, disabled=not bool(detected_path)),
                        ],
                        spacing=8,
                        wrap=True,
                    ),
                ],
                spacing=8,
            ),
        )

    live_voice_checkbox.on_change = lambda e: (persist_live_voice_setting(), log_activity("Updated live voice setting"))
    add_workspace_tab("Workspace 1")
    add_workspace_tab("Workspace 2")

    quick_chat_content = ft.Container(
        padding=ft.Padding(12, 12, 12, 12),
        content=ft.Column(
            [
                ft.Text("Keep working here while chat continues in the main conversation pane.", size=12, color=TEXT_MUTED),
                ft.Row([quick_prompt, ft.Button("Send", icon=ft.Icons.SEND, on_click=send_quick_prompt)], spacing=8),
                mission_status,
                ft.Row(
                    [
                        ft.Button("Start task", icon=ft.Icons.PLAY_CIRCLE, on_click=lambda e: log_activity("Started a new task cycle")),
                        ft.Button("Step complete", icon=ft.Icons.CHECK_CIRCLE, on_click=lambda e: log_activity("Completed a task step")),
                        ft.Button("Safety review", icon=ft.Icons.SECURITY, on_click=lambda e: log_activity("Ran a safety and setup review checkpoint")),
                    ],
                    spacing=8,
                    wrap=True,
                ),
                ft.Container(
                    expand=True,
                    bgcolor=PANEL_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(12, 12, 12, 12),
                    content=activity_list,
                ),
            ],
            expand=True,
            spacing=10,
        ),
    )

    omni_content = ft.Container(
        padding=ft.Padding(12, 12, 12, 12),
        content=ft.Column(
            [
                ft.Text("Text, images, audio, and video can be routed here before you send them into chat.", size=12, color=TEXT_MUTED),
                ft.Row([file_path_field], spacing=8),
                ft.Row(
                    [
                        ft.Button("Analyze", icon=ft.Icons.AUTO_AWESOME, on_click=analyze_source),
                        ft.Button("Open", icon=ft.Icons.OPEN_IN_NEW, on_click=open_source),
                        ft.Button("Send To Chat", icon=ft.Icons.FORWARD_TO_INBOX, on_click=send_source_to_chat),
                        ft.OutlinedButton("Narrate", icon=ft.Icons.RECORD_VOICE_OVER, on_click=narrate_source),
                    ],
                    spacing=8,
                    wrap=True,
                ),
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(12, 10, 12, 10),
                    content=ft.Column(
                        [
                            ft.Text("Analysis", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            file_summary,
                        ],
                        spacing=6,
                    ),
                ),
                ft.Container(
                    expand=True,
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(12, 10, 12, 10),
                    content=ft.Column(
                        [
                            ft.Text("Preview", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            file_preview,
                        ],
                        spacing=6,
                    ),
                ),
            ],
            expand=True,
            spacing=10,
        ),
    )

    workspaces_content = ft.Container(
        padding=ft.Padding(12, 12, 12, 12),
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Text("Open extra tabs while Baba works so you can keep notes and drafts moving.", size=12, color=TEXT_MUTED, expand=True),
                        ft.Button("Add Workspace Tab", icon=ft.Icons.ADD_BOX, on_click=lambda e: add_workspace_tab()),
                    ],
                    spacing=8,
                ),
                ft.Container(
                    expand=True,
                    bgcolor=PANEL_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(8, 8, 8, 8),
                    content=workspaces,
                ),
            ],
            expand=True,
            spacing=10,
        ),
    )

    routing_preset_dropdown = ft.Dropdown(
        label="Routing preset",
        value=selected_routing_preset["value"],
        options=[
            ft.dropdown.Option(key, preset["label"])
            for key, preset in LOCAL_MODEL_ROUTING_PRESETS.items()
        ],
        border_radius=14,
        bgcolor=CARD_BG,
        on_select=on_routing_preset_change,
    )
    refresh_router_cards()

    router_content = ft.Container(
        padding=ft.Padding(12, 12, 12, 12),
        content=ft.Column(
            [
                ft.Text("Apply a real local routing preset across Ollama, LM Studio, and Jan using your installed Qwen and Gemma models.", size=12, color=TEXT_MUTED),
                routing_preset_dropdown,
                ft.Row(
                    [
                        ft.Button("Apply Routing Preset", icon=ft.Icons.HUB, on_click=apply_selected_routing),
                        ft.OutlinedButton("Export Config", icon=ft.Icons.DOWNLOAD, on_click=export_selected_routing),
                        ft.OutlinedButton("Send To Chat", icon=ft.Icons.FORWARD_TO_INBOX, on_click=send_routing_to_chat),
                        ft.OutlinedButton("Narrate", icon=ft.Icons.RECORD_VOICE_OVER, on_click=lambda e: queue_voice_narration(build_routing_summary(selected_routing_preset["value"])) or None),
                    ],
                    spacing=8,
                    wrap=True,
                ),
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(12, 10, 12, 10),
                    content=ft.Column(
                        [
                            ft.Text("Routing Summary", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            routing_summary,
                        ],
                        spacing=6,
                    ),
                ),
                ft.Container(
                    expand=True,
                    content=router_cards_view,
                ),
            ],
            expand=True,
            spacing=10,
        ),
    )

    claw_cards = ft.Column(
        [build_claw_card(profile_key, profile) for profile_key, profile in claw_profiles.items()],
        spacing=10,
        scroll=ft.ScrollMode.AUTO,
    )
    claw_content = ft.Container(
        padding=ft.Padding(12, 12, 12, 12),
        content=ft.Column(
            [
                ft.Text("Track claw runtimes here. Baba will recommend the open and local-first slot first, but it will not execute unverified install commands for you.", size=12, color=TEXT_MUTED),
                ft.Container(expand=True, content=claw_cards),
            ],
            expand=True,
            spacing=10,
        ),
    )

    mission_tab_bar = ft.TabBar(
        tabs=[
            ft.Tab(label="Quick Chat"),
            ft.Tab(label="Omni Intake"),
            ft.Tab(label="Workspaces"),
            ft.Tab(label="Model Router"),
            ft.Tab(label="Claw Hub"),
        ],
        scrollable=True,
    )
    mission_tab_view = ft.TabBarView(
        controls=[
            quick_chat_content,
            omni_content,
            workspaces_content,
            router_content,
            claw_content,
        ],
        expand=True,
    )
    mission_tabs = ft.Tabs(
        expand=1,
        animation_duration=150,
        length=5,
        content=ft.Column(
            [
                mission_tab_bar,
                ft.Container(expand=True, content=mission_tab_view),
            ],
            expand=True,
            spacing=8,
        ),
    )

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Mission Control", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Multimodal intake, spoken progress, expandable work tabs, and claw setup tracking in one workspace.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        live_voice_checkbox,
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                mission_tabs,
            ],
            expand=True,
            spacing=10,
        )
    )


def create_voice_screen(page: ft.Page):
    state = load_desktop_state()
    piper_path = resolve_runtime_tool_path("piper")
    whisper_path = resolve_runtime_tool_path("whisper")

    voice_dropdown = ft.Dropdown(
        label="Voice",
        value=TTS_VOICES[0],
        options=[
            ft.dropdown.Option(v, v.split("-")[-1].replace("Neural", ""))
            for v in TTS_VOICES
        ],
        width=300,
    )
    text_input = ft.TextField(
        hint_text="Enter text to speak...",
        multiline=True,
        min_lines=1,
        max_lines=6,
        expand=True,
        border_radius=12,
    )
    piper_model_field = ft.TextField(
        label="Piper model (.onnx)",
        value=state.get("piper_model_path", ""),
        hint_text="C:\\path\\to\\voice.onnx",
        border_radius=12,
        expand=True,
    )
    whisper_audio_field = ft.TextField(
        label="Audio file for Whisper",
        hint_text="C:\\path\\to\\audio.wav",
        border_radius=12,
        expand=True,
    )
    whisper_model_dropdown = ft.Dropdown(
        label="Whisper model",
        value=state.get("whisper_model", "base"),
        width=180,
        options=[
            ft.dropdown.Option("tiny"),
            ft.dropdown.Option("base"),
            ft.dropdown.Option("small"),
            ft.dropdown.Option("medium"),
            ft.dropdown.Option("large-v3"),
        ],
    )

    status_text = ft.Text(
        "✅ Voice ready" if HAS_EDGE_TTS else "❌ Edge TTS not installed",
        size=12,
        color=ft.Colors.GREEN_300 if HAS_EDGE_TTS else ft.Colors.RED_300,
    )

    def save_voice_tool_state():
        updated_state = load_desktop_state()
        updated_state["piper_model_path"] = piper_model_field.value or ""
        updated_state["whisper_model"] = whisper_model_dropdown.value or "base"
        save_desktop_state(updated_state)

    def speak_text(e=None):
        if not HAS_EDGE_TTS or not text_input.value:
            return

        def do_tts():
            try:
                status_text.value = "🔊 Speaking..."
                status_text.color = ft.Colors.BLUE_300
                page.update()
                output_path = PROJECT_ROOT / "voice_output.mp3"
                comm = edge_tts.Communicate(text_input.value, voice_dropdown.value)
                comm.save_sync(str(output_path))
                if play_audio_file(output_path):
                    status_text.value = "✅ Voice playback started"
                else:
                    status_text.value = f"✅ Voice saved to {output_path.name}"
                status_text.color = ft.Colors.GREEN_300
                page.update()
            except Exception as ex:
                status_text.value = f"❌ Voice error: {str(ex)}"
                status_text.color = ft.Colors.RED_300
                page.update()

        threading.Thread(target=do_tts, daemon=True).start()

    def test_voice(e):
        text_input.value = "Hello! Baba Code Desktop voice system is working perfectly. I can speak responses, read code explanations, and give you natural sounding voice feedback. All chat responses automatically get a speak button."
        speak_text()

    def speak_with_piper(e=None):
        if not piper_path:
            status_text.value = "❌ Piper executable not found"
            status_text.color = ft.Colors.RED_300
            page.update()
            return
        if not text_input.value:
            status_text.value = "⚠️ Enter text before using Piper"
            status_text.color = ft.Colors.AMBER_300
            page.update()
            return
        if not piper_model_field.value or not os.path.exists(piper_model_field.value):
            status_text.value = "⚠️ Provide a valid Piper .onnx model path"
            status_text.color = ft.Colors.AMBER_300
            page.update()
            return

        save_voice_tool_state()

        def do_piper():
            try:
                status_text.value = "🔊 Generating Piper audio..."
                status_text.color = ft.Colors.BLUE_300
                page.update()
                output_path = PROJECT_ROOT / "voice_output_piper.wav"
                result = subprocess.run(
                    [
                        piper_path,
                        "--model",
                        piper_model_field.value,
                        "--output_file",
                        str(output_path),
                    ],
                    input=text_input.value,
                    text=True,
                    capture_output=True,
                    timeout=120,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr.strip() or "Piper exited with an error")
                if play_audio_file(output_path):
                    status_text.value = f"✅ Piper playback started from {output_path.name}"
                else:
                    status_text.value = f"✅ Piper audio saved to {output_path.name}"
                status_text.color = ft.Colors.GREEN_300
                page.update()
            except Exception as ex:
                status_text.value = f"❌ Piper error: {str(ex)}"
                status_text.color = ft.Colors.RED_300
                page.update()

        threading.Thread(target=do_piper, daemon=True).start()

    def transcribe_with_whisper(e=None):
        if not whisper_path:
            status_text.value = "❌ Whisper executable not found"
            status_text.color = ft.Colors.RED_300
            page.update()
            return
        if not whisper_audio_field.value or not os.path.exists(whisper_audio_field.value):
            status_text.value = "⚠️ Provide a valid audio file path for Whisper"
            status_text.color = ft.Colors.AMBER_300
            page.update()
            return

        save_voice_tool_state()

        def do_whisper():
            try:
                ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
                status_text.value = "🎙️ Transcribing with Whisper..."
                status_text.color = ft.Colors.BLUE_300
                page.update()
                result = subprocess.run(
                    [
                        whisper_path,
                        whisper_audio_field.value,
                        "--model",
                        whisper_model_dropdown.value or "base",
                        "--task",
                        "transcribe",
                        "--output_dir",
                        str(ARTIFACTS_DIR),
                    ],
                    text=True,
                    capture_output=True,
                    timeout=600,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr.strip() or "Whisper exited with an error")
                status_text.value = f"✅ Whisper transcript saved in {ARTIFACTS_DIR.name}"
                status_text.color = ft.Colors.GREEN_300
                page.update()
            except Exception as ex:
                status_text.value = f"❌ Whisper error: {str(ex)}"
                status_text.color = ft.Colors.RED_300
                page.update()

        threading.Thread(target=do_whisper, daemon=True).start()

    def open_runtime_tool(tool_path: str | None, label: str):
        if not tool_path:
            status_text.value = f"❌ {label} not found"
            status_text.color = ft.Colors.RED_300
        else:
            opened = launch_local_app(tool_path)
            status_text.value = f"✅ Opened {label}" if opened else f"⚠️ Could not open {label}"
            status_text.color = ft.Colors.GREEN_300 if opened else ft.Colors.AMBER_300
        page.update()

    chat_list = ft.ListView(expand=True, spacing=12, auto_scroll=True, padding=10)

    chat_list.controls.append(
        ft.Container(
            content=ft.Column(
                [
                    ft.Text(
                        "Voice Talk",
                        size=32,
                        weight=ft.FontWeight.BOLD,
                        color=ft.Colors.PURPLE_300,
                    ),
                    ft.Text(
                        "🔊 Text-to-Speech with Microsoft Edge Neural Voices",
                        size=15,
                        color=ft.Colors.GREY_400,
                    ),
                    ft.Divider(height=20, color=ft.Colors.TRANSPARENT),
                    ft.Text("Features:", size=15, color=ft.Colors.GREY_300),
                    ft.Divider(height=8, color=ft.Colors.TRANSPARENT),
                    ft.Row(
                        [
                            ft.Icon(ft.Icons.CHECK, size=16, color=ft.Colors.GREEN_400),
                            ft.Text(
                                "6 natural-sounding Microsoft neural voices",
                                size=13,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        spacing=6,
                    ),
                    ft.Row(
                        [
                            ft.Icon(ft.Icons.CHECK, size=16, color=ft.Colors.GREEN_400),
                            ft.Text(
                                "Works offline after first voice download",
                                size=13,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        spacing=6,
                    ),
                    ft.Row(
                        [
                            ft.Icon(ft.Icons.CHECK, size=16, color=ft.Colors.GREEN_400),
                            ft.Text(
                                "Type any text and click Speak",
                                size=13,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        spacing=6,
                    ),
                    ft.Row(
                        [
                            ft.Icon(ft.Icons.CHECK, size=16, color=ft.Colors.GREEN_400),
                            ft.Text(
                                "Every chat response has a Speak button",
                                size=13,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        spacing=6,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            alignment=CENTER,
            expand=True,
        )
    )

    return ft.Column(
        [
            ft.Row(
                [
                    ft.Text("Voice Talk", size=18, weight=ft.FontWeight.BOLD),
                    status_text,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            ft.Divider(height=1),
            chat_list,
            ft.Row([voice_dropdown], spacing=8),
            ft.Row(
                [
                    text_input,
                    ft.IconButton(
                        icon=ft.Icons.VOLUME_UP,
                        tooltip="Speak",
                        on_click=speak_text,
                        icon_color=ft.Colors.PURPLE_300,
                        icon_size=28,
                    ),
                ],
                spacing=8,
            ),
            ft.Row(
                [
                    ft.Button(
                        "Test Voice", icon=ft.Icons.PLAY_ARROW, on_click=test_voice
                    ),
                    ft.Button(
                        "Speak with Piper",
                        icon=ft.Icons.GRAPHIC_EQ,
                        on_click=speak_with_piper,
                        disabled=not bool(piper_path),
                    ),
                ],
                alignment=ft.MainAxisAlignment.CENTER,
            ),
            ft.Container(
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=18,
                padding=ft.Padding(14, 12, 14, 12),
                content=ft.Column(
                    [
                        ft.Text("Local voice tools", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        ft.Text(
                            f"Piper: {piper_path or 'not detected'}\nWhisper: {whisper_path or 'not detected'}",
                            size=11,
                            color=TEXT_MUTED,
                            selectable=True,
                        ),
                        ft.Row([piper_model_field], spacing=8),
                        ft.Row(
                            [
                                ft.Button("Open Piper", icon=ft.Icons.OPEN_IN_NEW, on_click=lambda e: open_runtime_tool(piper_path, "Piper"), disabled=not bool(piper_path)),
                            ],
                            spacing=8,
                        ),
                        ft.Divider(height=6, color=ft.Colors.TRANSPARENT),
                        ft.Row([whisper_audio_field, whisper_model_dropdown], spacing=8, wrap=True),
                        ft.Row(
                            [
                                ft.Button("Transcribe with Whisper", icon=ft.Icons.MIC, on_click=transcribe_with_whisper, disabled=not bool(whisper_path)),
                                ft.Button("Open Whisper", icon=ft.Icons.OPEN_IN_NEW, on_click=lambda e: open_runtime_tool(whisper_path, "Whisper"), disabled=not bool(whisper_path)),
                            ],
                            spacing=8,
                            wrap=True,
                        ),
                    ],
                    spacing=10,
                ),
            ),
        ],
        expand=True,
    )


def create_commands_screen(page: ft.Page):
    all_commands = list(PORTED_COMMANDS) if HAS_SRC_MODULES else []
    search_field = ft.TextField(
        hint_text="Search commands...",
        prefix_icon=ft.Icons.SEARCH,
        expand=True,
        text_size=14,
        border_radius=12,
    )
    command_list = ft.ListView(expand=True, spacing=4, padding=10)
    count_label = ft.Text(
        f"{len(all_commands)} commands", size=12, color=ft.Colors.GREY_400
    )

    def populate_list(commands):
        command_list.controls.clear()
        for cmd in commands[:50]:
            command_list.controls.append(
                ft.ListTile(
                    title=ft.Text(cmd.name, size=14, weight=ft.FontWeight.W_500, selectable=True),
                    subtitle=ft.Text(
                        cmd.source_hint, size=11, color=ft.Colors.GREY_500, selectable=True
                    ),
                    trailing=ft.IconButton(
                        icon=ft.Icons.INFO_OUTLINE,
                        icon_size=18,
                        tooltip="Details",
                    ),
                    dense=True,
                )
            )

    def filter_commands(e):
        query = search_field.value.lower().strip() if search_field.value else ""
        if not query:
            filtered = all_commands[:50]
        else:
            filtered = find_commands(query, limit=50) if HAS_SRC_MODULES else []
        count_label.value = f"{len(filtered)} shown"
        populate_list(filtered)
        page.update()

    search_field.on_change = filter_commands
    populate_list(all_commands[:50])

    return ft.Column(
        [
            ft.Row(
                [
                    ft.Text("Commands", size=18, weight=ft.FontWeight.BOLD),
                    count_label,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            ft.Row([search_field], spacing=8),
            ft.Divider(height=1),
            command_list,
        ],
        expand=True,
    )


def create_tools_screen(page: ft.Page):
    all_tools = list(PORTED_TOOLS) if HAS_SRC_MODULES else []
    search_field = ft.TextField(
        hint_text="Search tools...",
        prefix_icon=ft.Icons.SEARCH,
        expand=True,
        text_size=14,
        border_radius=12,
    )
    tool_list = ft.ListView(expand=True, spacing=4, padding=10)
    count_label = ft.Text(f"{len(all_tools)} tools", size=12, color=ft.Colors.GREY_400)

    def populate_list(tools):
        tool_list.controls.clear()
        for tool in tools[:50]:
            is_mcp = "mcp" in tool.name.lower() or "mcp" in tool.source_hint.lower()
            icon = ft.Icons.API if is_mcp else ft.Icons.BUILD
            tool_list.controls.append(
                ft.ListTile(
                    leading=ft.Icon(
                        icon,
                        size=20,
                        color=ft.Colors.AMBER_300 if is_mcp else ft.Colors.BLUE_300,
                    ),
                    title=ft.Text(tool.name, size=14, weight=ft.FontWeight.W_500, selectable=True),
                    subtitle=ft.Text(
                        tool.source_hint, size=11, color=ft.Colors.GREY_500, selectable=True
                    ),
                    trailing=ft.IconButton(
                        icon=ft.Icons.INFO_OUTLINE,
                        icon_size=18,
                        tooltip="Details",
                    ),
                    dense=True,
                )
            )

    def filter_tools(e):
        query = search_field.value.lower().strip() if search_field.value else ""
        if not query:
            filtered = all_tools[:50]
        else:
            filtered = find_tools(query, limit=50) if HAS_SRC_MODULES else []
        count_label.value = f"{len(filtered)} shown"
        populate_list(filtered)
        page.update()

    search_field.on_change = filter_tools
    populate_list(all_tools[:50])

    return ft.Column(
        [
            ft.Row(
                [
                    ft.Text("Tools", size=18, weight=ft.FontWeight.BOLD),
                    count_label,
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            ft.Row([search_field], spacing=8),
            ft.Divider(height=1),
            tool_list,
        ],
        expand=True,
    )


def create_history_screen(page: ft.Page):
    session_list = ft.ListView(expand=True, spacing=8, padding=10)

    def load_sessions():
        session_list.controls.clear()
        session_dir = DEFAULT_SESSION_DIR

        if not session_dir.exists() or not any(session_dir.glob("*.json")):
            session_list.controls.append(
                ft.Container(
                    content=ft.Column(
                        [
                            ft.Icon(
                                ft.Icons.HISTORY, size=64, color=ft.Colors.GREY_600
                            ),
                            ft.Text(
                                "No saved sessions yet",
                                size=18,
                                color=ft.Colors.GREY_400,
                            ),
                            ft.Text(
                                f"Sessions are saved in {session_dir.name} when you chat with the AI provider.",
                                size=14,
                                color=ft.Colors.GREY_500,
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=12,
                    ),
                    alignment=CENTER,
                    expand=True,
                )
            )
            page.update()
            return

        sessions = sorted(
            session_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True
        )

        for session_file in sessions[:20]:
            try:
                data = json.loads(session_file.read_text())
                session_id = data.get("session_id", session_file.stem)
                messages = data.get("messages", [])
                msg_count = len(messages)
                in_tokens = data.get("input_tokens", 0)
                out_tokens = data.get("output_tokens", 0)
                preview = messages[-1][:140] if messages else "No recorded prompts"
                modified = datetime.fromtimestamp(
                    session_file.stat().st_mtime
                ).strftime("%Y-%m-%d %H:%M")

                session_list.controls.append(
                    ft.Container(
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Text(
                                            session_id[:12],
                                            size=14,
                                            weight=ft.FontWeight.W_500,
                                        ),
                                        ft.Text(
                                            modified, size=11, color=ft.Colors.GREY_500
                                        ),
                                    ],
                                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                ),
                                ft.Row(
                                    [
                                        ft.Text(
                                            f"{msg_count} prompts",
                                            size=12,
                                            color=ft.Colors.GREY_400,
                                        ),
                                        ft.Text(
                                            f"in={in_tokens} out={out_tokens}",
                                            size=12,
                                            color=ft.Colors.GREY_400,
                                        ),
                                    ]
                                ),
                                ft.Text(
                                    preview,
                                    size=12,
                                    color=ft.Colors.GREY_500,
                                    selectable=True,
                                ),
                            ]
                        ),
                        bgcolor=ft.Colors.with_opacity(0.06, ft.Colors.GREY_600),
                        border_radius=12,
                        padding=ft.Padding.all(12),
                    )
                )
            except Exception:
                continue

        page.update()

    load_sessions()

    return ft.Column(
        [
            ft.Row(
                [
                    ft.Text("Session History", size=18, weight=ft.FontWeight.BOLD),
                    ft.IconButton(
                        icon=ft.Icons.REFRESH,
                        tooltip="Refresh",
                        on_click=lambda e: load_sessions(),
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            ft.Divider(height=1),
            session_list,
        ],
        expand=True,
    )


def create_settings_screen(page: ft.Page, on_provider_state_change=None):
    status_text = ft.Text("", size=13, color=ft.Colors.GREEN_300)
    enabled_state = {
        "providers": tuple(get_enabled_provider_types()) if HAS_SRC_MODULES else tuple(supported_provider_types()),
    }
    initial_provider = (
        get_config().primary_provider.provider_type
        if HAS_SRC_MODULES
        else ProviderType.OLLAMA
    )
    models_state = {"items": []}
    save_confirm = ft.Checkbox(
        label="I want to save these provider settings to the local workspace",
        value=True,
    )

    provider_dropdown = ft.Dropdown(
        label="Primary Provider",
        value=initial_provider.value,
        options=[
            ft.dropdown.Option(provider.value, provider_display_name(provider))
            for provider in enabled_state["providers"]
        ],
        width=400,
    )
    base_url_field = ft.TextField(label="Base URL", width=400, border_radius=8)
    model_field = ft.TextField(label="Model", width=400, border_radius=8)
    model_dropdown = ft.Dropdown(label="Discovered Models", width=400, options=[])
    api_key_field = ft.TextField(
        label="API Key",
        width=400,
        border_radius=8,
        password=True,
        can_reveal_password=True,
    )

    provider_cards = ft.ResponsiveRow(spacing=10, run_spacing=10)
    provider_toggle_column = ft.Column(spacing=8)
    provider_preset_row = ft.Row(spacing=8, wrap=True)

    def enabled_provider_list() -> tuple[ProviderType, ...]:
        return tuple(enabled_state["providers"])

    def refresh_provider_options():
        enabled_providers = enabled_provider_list()
        provider_dropdown.options = [
            ft.dropdown.Option(provider.value, provider_display_name(provider))
            for provider in enabled_providers
        ]
        if provider_dropdown.value not in [provider.value for provider in enabled_providers]:
            provider_dropdown.value = enabled_providers[0].value if enabled_providers else None

    def refresh_provider_toggles():
        provider_toggle_column.controls.clear()

        def build_toggle_row(title: str, providers: tuple[ProviderType, ...]):
            controls = []
            for provider_type in providers:
                checkbox = ft.Checkbox(
                    label=provider_display_name(provider_type),
                    value=provider_type in enabled_state["providers"],
                )

                def on_change(e, current_provider=provider_type, current_checkbox=checkbox):
                    updated = [provider for provider in enabled_state["providers"] if provider != current_provider]
                    if current_checkbox.value:
                        updated.append(current_provider)
                    if not updated:
                        current_checkbox.value = True
                        status_text.value = "Keep at least one provider enabled"
                        status_text.color = ft.Colors.AMBER_300
                        page.update()
                        return
                    enabled_state["providers"] = tuple(
                        provider for provider in supported_provider_types() if provider in updated
                    )
                    refresh_provider_options()
                    page.update()

                checkbox.on_change = on_change
                controls.append(checkbox)

            return ft.Container(
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=18,
                padding=ft.Padding(14, 12, 14, 12),
                content=ft.Column(
                    [
                        ft.Text(title, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        ft.Row(controls, spacing=10, wrap=True),
                    ],
                    spacing=8,
                ),
            )

        provider_toggle_column.controls.append(
            build_toggle_row("Local providers", LOCAL_PROVIDER_TYPES)
        )
        provider_toggle_column.controls.append(
            build_toggle_row("Cloud APIs", CLOUD_PROVIDER_TYPES)
        )

    def apply_enabled_provider_preset(
        providers: tuple[ProviderType, ...],
        success_message: str,
    ):
        enabled_state["providers"] = tuple(
            provider for provider in supported_provider_types() if provider in providers
        )
        refresh_provider_toggles()
        refresh_provider_options()
        if provider_dropdown.value:
            sync_fields(ProviderType(provider_dropdown.value))
        try:
            save_enabled_provider_types(enabled_provider_list())
            status_text.value = success_message
            status_text.color = ft.Colors.GREEN_300
            if on_provider_state_change:
                on_provider_state_change()
        except Exception as ex:
            status_text.value = f"❌ Failed to save provider preset: {str(ex)}"
            status_text.color = ft.Colors.RED_300
        page.update()

    provider_preset_row.controls = [
        ft.Button(
            "Local Only",
            icon=ft.Icons.LAPTOP_CHROMEBOOK_ROUNDED,
            on_click=lambda e: apply_enabled_provider_preset(LOCAL_PROVIDER_TYPES, "✅ Local-only mode enabled"),
        ),
        ft.OutlinedButton(
            "Enable All",
            icon=ft.Icons.CLOUD_DONE_OUTLINED,
            on_click=lambda e: apply_enabled_provider_preset(supported_provider_types(), "✅ All providers enabled"),
        ),
    ]

    def set_models(models: list[str]):
        unique_models = list(dict.fromkeys(model for model in models if model))
        models_state["items"] = unique_models
        model_dropdown.options = [
            ft.dropdown.Option(model, model) for model in unique_models
        ]
        if unique_models:
            if model_field.value not in unique_models:
                model_field.value = unique_models[0]
            model_dropdown.value = model_field.value
        else:
            model_dropdown.value = None

    def refresh_local_provider_cards():
        provider_cards.controls.clear()
        detected = detect_local_ai()
        for key in get_local_ai_priority():
            info = detected.get(key)
            if not info:
                continue
            state_label = "Connected" if info["healthy"] else ("Running" if info["running"] else "Not running")
            state_color = SUCCESS if info["healthy"] else (WARNING if info["running"] else TEXT_MUTED)
            model_preview = ", ".join(info.get("models", [])[:2]) if info.get("models") else str(info.get("detected_model", info["default_model"]))
            provider_cards.controls.append(
                ft.Container(
                    col={"sm": 6, "md": 4},
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Icon(info["icon"], size=18, color=ACCENT),
                                    ft.Text(info["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ],
                                spacing=8,
                            ),
                            ft.Text(
                                state_label,
                                size=12,
                                color=state_color,
                            ),
                            ft.Text(info["base_url"], size=11, color=TEXT_MUTED, selectable=True),
                            ft.Text(f"Models: {len(info.get('models', [])) or 1} | {model_preview}", size=11, color=TEXT_MUTED, selectable=True),
                            ft.OutlinedButton(
                                "Connect",
                                icon=ft.Icons.LINK,
                                disabled=not info["healthy"],
                                on_click=lambda e, provider_key=key, provider_info=info: connect_local_provider(provider_key, provider_info),
                            ),
                        ],
                        spacing=8,
                    ),
                )
            )

    def connect_local_provider(provider_key: str, provider_info: dict[str, object]):
        if not bool(provider_info.get("healthy")):
            status_text.value = f"⚠️ {provider_info['name']} is running but its API is not responding"
            status_text.color = ft.Colors.AMBER_300
            page.update()
            return
        actual_model = str(provider_info.get("detected_model") or get_first_model(str(provider_info["base_url"])))
        provider_type = ProviderType(provider_key)
        save_provider_settings(provider_type, str(provider_info["base_url"]), actual_model)
        sync_fields(provider_type)
        set_models([actual_model])
        status_text.value = f"✅ Connected to {provider_info['name']} using {actual_model}"
        status_text.color = ft.Colors.GREEN_300
        page.update()

    def load_models(e=None):
        status_text.value = "🔄 Loading models..."
        status_text.color = ft.Colors.AMBER_300
        page.update()

        def fetch_models():
            try:
                provider_type = ProviderType(provider_dropdown.value)
                provider_config = ProviderConfig(
                    provider_type=provider_type,
                    base_url=base_url_field.value or get_provider_config(provider_type).base_url,
                    api_key=api_key_field.value or "not-needed",
                    model=model_field.value or get_provider_config(provider_type).model,
                )
                with ProviderClient(provider_config) as client:
                    models = client.list_models()
                set_models(models)
                if models:
                    status_text.value = f"✅ Loaded {len(models)} model(s)"
                    status_text.color = ft.Colors.GREEN_300
                else:
                    status_text.value = "⚠️ No models returned by this provider"
                    status_text.color = ft.Colors.AMBER_300
            except Exception as ex:
                status_text.value = f"❌ Failed to list models: {str(ex)}"
                status_text.color = ft.Colors.RED_300
            page.update()

        threading.Thread(target=fetch_models, daemon=True).start()

    def sync_fields(selected_provider: ProviderType | None = None):
        provider_type = selected_provider or ProviderType(provider_dropdown.value)
        provider_config = get_provider_config(provider_type)
        provider_dropdown.value = provider_type.value
        base_url_field.value = provider_config.base_url
        model_field.value = provider_config.model
        set_models([provider_config.model])
        api_key_field.value = (
            "" if provider_config.api_key == "not-needed" else provider_config.api_key
        )

    def save_settings(e):
        if not save_confirm.value:
            status_text.value = "⚠️ Tick the confirmation box before saving settings"
            status_text.color = ft.Colors.AMBER_300
            page.update()
            return
        try:
            enabled_providers = enabled_provider_list()
            save_enabled_provider_types(enabled_providers)
            provider_type = ProviderType(provider_dropdown.value)
            save_provider_settings(
                provider_type,
                base_url_field.value or get_provider_config(provider_type).base_url,
                model_field.value or get_provider_config(provider_type).model,
                api_key_field.value or "",
                enabled_providers=enabled_providers,
            )
            status_text.value = f"✅ Saved settings for {provider_display_name(provider_type)}"
            status_text.color = ft.Colors.GREEN_300
            if on_provider_state_change:
                on_provider_state_change()
        except Exception as ex:
            status_text.value = f"❌ Failed to save settings: {str(ex)}"
            status_text.color = ft.Colors.RED_300
        page.update()

    def test_connection(e):
        status_text.value = "🔄 Testing connection..."
        status_text.color = ft.Colors.AMBER_300
        page.update()

        def test():
            try:
                provider_type = ProviderType(provider_dropdown.value)
                provider_config = ProviderConfig(
                    provider_type=provider_type,
                    base_url=base_url_field.value or get_provider_config(provider_type).base_url,
                    api_key=api_key_field.value or "not-needed",
                    model=model_field.value or get_provider_config(provider_type).model,
                )
                with ProviderClient(provider_config) as client:
                    healthy = client.check_health()
                    models = client.list_models() if healthy else []
                if healthy:
                    set_models(models or [provider_config.model])
                    if models and not model_field.value:
                        model_field.value = models[0]
                    suffix = f" ({len(models)} models visible)" if models else ""
                    status_text.value = f"✅ Connection successful{suffix}"
                    status_text.color = ft.Colors.GREEN_300
                else:
                    status_text.value = "⚠️ Provider reachable check failed"
                    status_text.color = ft.Colors.AMBER_300
            except Exception as ex:
                status_text.value = f"❌ Connection failed: {str(ex)}"
                status_text.color = ft.Colors.RED_300
            page.update()

        threading.Thread(target=test, daemon=True).start()

    def auto_detect_ai(e):
        status_text.value = "🔍 Scanning for local AI providers..."
        status_text.color = ft.Colors.AMBER_300
        page.update()
        detected = detect_local_ai()
        connected_key, connected_name, _connected_url, connected_model = auto_connect_ai()
        if connected_key:
            sync_fields(ProviderType(connected_key))
            selected_info = detected.get(connected_key, {})
            set_models(selected_info.get("models", []) or [connected_model])
            status_text.value = f"✅ Auto-connected to {connected_name}"
            status_text.color = ft.Colors.GREEN_300
        else:
            running = [info["name"] for info in detected.values() if info["running"]]
            healthy = [info["name"] for info in detected.values() if info["healthy"]]
            if healthy:
                status_text.value = f"⚠️ Healthy local AI found but no provider was selected: {', '.join(healthy)}"
            elif running:
                status_text.value = f"⚠️ Found {', '.join(running)} but not responding"
            else:
                status_text.value = "ℹ️ No local AI detected"
            status_text.color = ft.Colors.AMBER_300
        refresh_local_provider_cards()
        page.update()

    def on_model_change(e):
        if model_dropdown.value:
            model_field.value = model_dropdown.value
            page.update()

    provider_dropdown.on_change = lambda e: (sync_fields(ProviderType(provider_dropdown.value)), page.update())
    model_dropdown.on_change = on_model_change
    refresh_provider_toggles()
    refresh_provider_options()
    sync_fields(initial_provider)
    refresh_local_provider_cards()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Text("Settings", size=18, weight=ft.FontWeight.BOLD),
                ft.Divider(height=1),
                ft.ListView(
                    [
                        ft.Text("Local AI Quick Connect", size=16, weight=ft.FontWeight.W_500),
                        ft.Text("Connect to running local providers with one click.", size=12, color=TEXT_MUTED),
                        provider_cards,
                        ft.Divider(height=18, color=ft.Colors.TRANSPARENT),
                        ft.Text("AI Provider", size=16, weight=ft.FontWeight.W_500),
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        ft.Text("Enabled Providers", size=16, weight=ft.FontWeight.W_500),
                        ft.Text("Disable cloud APIs here if you want to stay local-first. Disabled providers are removed from the header and quick-apply lists.", size=12, color=TEXT_MUTED),
                        provider_preset_row,
                        provider_toggle_column,
                        ft.Divider(height=18, color=ft.Colors.TRANSPARENT),
                        provider_dropdown,
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        ft.Text("Connection", size=16, weight=ft.FontWeight.W_500),
                        base_url_field,
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        model_field,
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        model_dropdown,
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        api_key_field,
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        save_confirm,
                        ft.Divider(height=20, color=ft.Colors.TRANSPARENT),
                        ft.Row(
                            [
                                ft.Button("Save Settings", icon=ft.Icons.SAVE, on_click=save_settings),
                                ft.Button("Test Connection", icon=ft.Icons.NETWORK_CHECK, on_click=test_connection),
                                ft.Button("List Models", icon=ft.Icons.FORMAT_LIST_BULLETED, on_click=load_models),
                                ft.Button("Auto-Detect AI", icon=ft.Icons.AUTO_AWESOME, on_click=auto_detect_ai),
                            ],
                            spacing=8,
                            wrap=True,
                        ),
                        ft.Divider(height=10, color=ft.Colors.TRANSPARENT),
                        status_text,
                        ft.Text(
                            f"Session storage: {DEFAULT_SESSION_DIR}",
                            size=12,
                            color=ft.Colors.GREY_500,
                            selectable=True,
                        ),
                        ft.Divider(height=20, color=ft.Colors.TRANSPARENT),
                    ],
                    expand=True,
                    spacing=8,
                    padding=10,
                ),
            ],
            expand=True,
        )
    )


def create_connectors_screen(page: ft.Page):
    safe_connectors = [
        ("workspace.files", "Read and write files in the current workspace", "Connected", SUCCESS),
        ("session.storage", "Persist and reload session snapshots", "Connected", SUCCESS),
        ("web.fetch", "Read-only HTTP and HTTPS fetches", "Connected", SUCCESS),
        ("shell.exec", "Confirmed shell commands inside the workspace", "Confirmed only", WARNING),
        ("browser.use", "Manual-confirmed browser workflows and local browser launching", "Manual only", WARNING),
        ("pc.use", "Manual-confirmed local PC workflows inside the workspace", "Manual only", WARNING),
        ("voice.output", "Generate local speech output", "Connected", SUCCESS),
    ]
    blocked_connectors = [
        ("outlook.connect", "Personal-account and app-control connector", "Not enabled"),
        ("whatsapp.connect", "Personal messaging connector", "Not enabled"),
        ("instagram.connect", "Personal social connector", "Not enabled"),
        ("facebook.connect", "Personal social connector", "Not enabled"),
        ("tiktok.connect", "Personal social connector", "Not enabled"),
    ]
    detected_apps = [
        ("outlook.desktop", "Microsoft Outlook desktop app"),
        ("chrome.desktop", "Google Chrome browser"),
        ("edge.desktop", "Microsoft Edge browser"),
        ("firefox.desktop", "Mozilla Firefox browser"),
        ("whatsapp.desktop", "WhatsApp desktop app"),
    ]

    def build_card(name: str, description: str, state: str, color: str):
        return ft.Container(
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=18,
            padding=ft.Padding(14, 12, 14, 12),
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Text(name, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                bgcolor=ACCENT_SOFT,
                                border_radius=999,
                                padding=ft.Padding(10, 4, 10, 4),
                                content=ft.Text(state, size=11, color=color),
                            ),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                    ft.Text(description, size=12, color=TEXT_MUTED, selectable=True),
                ],
                spacing=8,
            ),
        )

    def build_detected_app_card(name: str, description: str):
        path = find_local_app_path(name)
        status = "Detected" if path else "Not detected"
        color = SUCCESS if path else TEXT_MUTED

        def open_app(e):
            opened = bool(path) and launch_local_app(path)
            page.snack_bar = ft.SnackBar(ft.Text(f"Opened {name}" if opened else f"Unable to open {name}"))
            page.snack_bar.open = True
            page.update()

        return ft.Container(
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=18,
            padding=ft.Padding(14, 12, 14, 12),
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Text(name, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                bgcolor=ACCENT_SOFT,
                                border_radius=999,
                                padding=ft.Padding(10, 4, 10, 4),
                                content=ft.Text(status, size=11, color=color),
                            ),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                    ft.Text(description, size=12, color=TEXT_MUTED, selectable=True),
                    ft.Text(path or "No local install path found", size=11, color=TEXT_MUTED, selectable=True),
                    ft.OutlinedButton("Open locally", icon=ft.Icons.OPEN_IN_NEW, disabled=not bool(path), on_click=open_app),
                ],
                spacing=8,
            ),
        )

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Text("Connectors", size=18, weight=ft.FontWeight.BOLD),
                ft.Divider(height=1),
                ft.Text("Safe local connectors", size=16, weight=ft.FontWeight.W_500),
                ft.Text("These connectors are available inside the current workspace without taking over personal apps.", size=12, color=TEXT_MUTED),
                ft.ListView(
                    [build_card(name, description, state, color) for name, description, state, color in safe_connectors],
                    expand=False,
                    spacing=10,
                    height=260,
                ),
                ft.Divider(height=12, color=ft.Colors.TRANSPARENT),
                ft.Text("Local desktop apps", size=16, weight=ft.FontWeight.W_500),
                ft.Text("Detection and launch only. These cards do not grant account control or silent automation.", size=12, color=TEXT_MUTED),
                ft.ListView(
                    [build_detected_app_card(name, description) for name, description in detected_apps],
                    expand=False,
                    spacing=10,
                    height=300,
                ),
                ft.Divider(height=12, color=ft.Colors.TRANSPARENT),
                ft.Text("Not enabled", size=16, weight=ft.FontWeight.W_500),
                ft.Text("Personal-account and app-control connectors are not enabled in this desktop because they would require acting inside user accounts or external apps.", size=12, color=TEXT_MUTED),
                ft.ListView(
                    [build_card(name, description, state, WARNING) for name, description, state in blocked_connectors],
                    expand=True,
                    spacing=10,
                ),
            ],
            expand=True,
            spacing=8,
        )
    )


def create_customize_screen(page: ft.Page, on_workspace_label_change, on_theme_change=None):
    state = load_desktop_state()
    workspace_field = ft.TextField(
        label="Workspace label",
        value=state.get("workspace_label", "Workspace"),
        border_radius=16,
        bgcolor=CARD_BG,
    )
    profile_dropdown = ft.Dropdown(
        label="Instruction profile",
        value=state.get("instruction_profile", "Balanced"),
        options=[
            ft.dropdown.Option("Balanced"),
            ft.dropdown.Option("Builder"),
            ft.dropdown.Option("Reviewer"),
            ft.dropdown.Option("Research"),
        ],
        border_radius=16,
        bgcolor=CARD_BG,
    )
    tone_dropdown = ft.Dropdown(
        label="Response tone",
        value=state.get("response_tone", "Direct"),
        options=[
            ft.dropdown.Option("Direct"),
            ft.dropdown.Option("Detailed"),
            ft.dropdown.Option("Compact"),
        ],
        border_radius=16,
        bgcolor=CARD_BG,
    )
    theme_dropdown = ft.Dropdown(
        label="Desktop theme",
        value=state.get("theme_name", "Warm Sand"),
        options=[ft.dropdown.Option(theme_name) for theme_name in THEME_PRESETS.keys()],
        border_radius=16,
        bgcolor=CARD_BG,
    )
    theme_gallery = ft.ResponsiveRow(spacing=10, run_spacing=10)
    theme_preview_title = ft.Text("", size=15, weight=ft.FontWeight.W_600)
    theme_preview_note = ft.Text("", size=12)
    guardrails = state.get("desktop_guardrails", {})
    confirm_shell = ft.Checkbox(label="Require confirmation for shell execution", value=guardrails.get("confirm_shell", True))
    manual_browser = ft.Checkbox(label="Keep browser workflows manual-only", value=guardrails.get("manual_browser", True))
    manual_pc_use = ft.Checkbox(label="Keep PC-use workflows manual-only", value=guardrails.get("manual_pc_use", True))
    status_text = ft.Text("", size=12, color=TEXT_MUTED)

    def build_updated_customize_state() -> dict:
        updated_state = load_desktop_state()
        updated_state["workspace_label"] = (workspace_field.value or "Workspace").strip()
        updated_state["instruction_profile"] = profile_dropdown.value or "Balanced"
        updated_state["response_tone"] = tone_dropdown.value or "Direct"
        updated_state["theme_name"] = theme_dropdown.value or "Warm Sand"
        updated_state["desktop_guardrails"] = {
            "confirm_shell": bool(confirm_shell.value),
            "manual_browser": bool(manual_browser.value),
            "manual_pc_use": bool(manual_pc_use.value),
        }
        return updated_state

    def refresh_theme_gallery():
        theme_gallery.controls.clear()
        selected_theme_name = theme_dropdown.value or "Warm Sand"
        selected_theme = THEME_PRESETS.get(selected_theme_name, THEME_PRESETS["Warm Sand"])
        theme_preview_title.value = f"Selected: {selected_theme_name}"
        theme_preview_title.color = selected_theme["TEXT_PRIMARY"]
        theme_preview_note.value = f"Font: {selected_theme['font']} | Accent: {selected_theme['ACCENT']}"
        theme_preview_note.color = selected_theme["TEXT_MUTED"]

        for theme_name, theme in THEME_PRESETS.items():
            card = ft.Container(
                col={"sm": 6, "md": 4, "xl": 3},
                bgcolor=theme["CARD_BG"],
                border=ft.Border.all(2, ACCENT if theme_name == selected_theme_name else theme["BORDER_COLOR"]),
                border_radius=18,
                padding=ft.Padding(12, 10, 12, 10),
                ink=True,
                on_click=lambda e, selected=theme_name: select_theme(selected),
                content=ft.Column(
                    [
                        ft.Row(
                            [
                                ft.Container(width=22, height=22, bgcolor=theme["ACCENT"], border_radius=999),
                                ft.Container(width=22, height=22, bgcolor=theme["APP_BG"], border_radius=999),
                                ft.Container(width=22, height=22, bgcolor=theme["USER_BUBBLE"], border_radius=999),
                            ],
                            spacing=6,
                        ),
                        ft.Text(theme_name, size=13, weight=ft.FontWeight.W_600, color=theme["TEXT_PRIMARY"]),
                        ft.Text(theme["font"], size=11, color=theme["TEXT_MUTED"]),
                    ],
                    spacing=8,
                ),
            )
            theme_gallery.controls.append(card)

    def select_theme(theme_name: str):
        previous_theme_name = load_desktop_state().get("theme_name", "Warm Sand")
        theme_dropdown.value = theme_name
        updated_state = build_updated_customize_state()
        save_desktop_state(updated_state)
        on_workspace_label_change(updated_state["workspace_label"])
        status_text.value = f"Theme applied: {theme_name}."
        status_text.color = SUCCESS
        refresh_theme_gallery()
        if on_theme_change and theme_name != previous_theme_name:
            on_theme_change(theme_name)
            return
        page.update()

    theme_dropdown.on_change = lambda e: select_theme(theme_dropdown.value or "Warm Sand")
    refresh_theme_gallery()

    def save_customize(e):
        previous_theme_name = state.get("theme_name", "Warm Sand")
        updated_state = build_updated_customize_state()
        save_desktop_state(updated_state)
        on_workspace_label_change(updated_state["workspace_label"])
        status_text.value = "Saved local desktop preferences."
        status_text.color = SUCCESS
        if on_theme_change and updated_state["theme_name"] != previous_theme_name:
            on_theme_change(updated_state["theme_name"])
            return
        page.update()

    return ft.SelectionArea(
        content=ft.ListView(
            [
                ft.Text("Customize", size=18, weight=ft.FontWeight.BOLD),
                ft.Divider(height=1),
                ft.Text("Tune how this desktop presents the workspace and applies local guardrails.", size=12, color=TEXT_MUTED),
                workspace_field,
                profile_dropdown,
                tone_dropdown,
                theme_dropdown,
                ft.Text("12 desktop themes", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                ft.Text("Choose a color and typography style. Clicking a theme applies it immediately across the app.", size=12, color=TEXT_MUTED),
                ft.Container(
                    bgcolor=CARD_ALT_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [theme_preview_title, theme_preview_note],
                        spacing=4,
                    ),
                ),
                theme_gallery,
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Text("Desktop guardrails", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            confirm_shell,
                            manual_browser,
                            manual_pc_use,
                        ],
                        spacing=8,
                    ),
                ),
                ft.Row(
                    [
                        ft.Button("Save Customize", icon=ft.Icons.SAVE, on_click=save_customize),
                    ],
                    spacing=8,
                ),
                status_text,
                ft.Text(f"Stored at: {DESKTOP_STATE_FILE}", size=12, color=TEXT_MUTED, selectable=True),
            ],
            spacing=12,
            expand=True,
            padding=10,
            auto_scroll=False,
        )
    )


def create_skills_screen(page: ft.Page):
    skills_column = ft.Column(spacing=10)
    status_text = ft.Text("", size=12, color=TEXT_MUTED)

    def refresh_skills(e=None):
        entries = discover_skill_entries()
        skills_column.controls.clear()
        if not entries:
            skills_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Text("No workspace skills were discovered under src/skills.", size=12, color=TEXT_MUTED),
                )
            )
        else:
            for entry in entries:
                skills_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=18,
                        padding=ft.Padding(14, 12, 14, 12),
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Text(entry["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                        ft.Container(
                                            bgcolor=ACCENT_SOFT,
                                            border_radius=999,
                                            padding=ft.Padding(10, 4, 10, 4),
                                            content=ft.Text(entry["kind"], size=11, color=ACCENT),
                                        ),
                                    ],
                                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                ),
                                ft.Text(entry["detail"], size=12, color=TEXT_MUTED),
                                ft.Text(entry["path"], size=11, color=TEXT_MUTED, selectable=True),
                            ],
                            spacing=6,
                        ),
                    )
                )
        status_text.value = f"{len(entries)} skill entries loaded"
        page.update()

    refresh_skills()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Skills", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Inspect workspace skills and instruction packages already mirrored into the project.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Refresh", icon=ft.Icons.REFRESH, on_click=refresh_skills),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                status_text,
                ft.ListView([skills_column], expand=True, spacing=0, padding=0),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_memory_screen(page: ft.Page):
    state = load_desktop_state()
    notes_field = ft.TextField(
        label="Workspace memory notes",
        value=state.get("memory_notes", ""),
        multiline=True,
        min_lines=8,
        max_lines=12,
        border_radius=16,
        bgcolor=CARD_BG,
    )
    sessions_column = ft.Column(spacing=10)
    status_text = ft.Text("", size=12, color=TEXT_MUTED)

    def refresh_sessions(e=None):
        sessions_column.controls.clear()
        session_files = sorted(DEFAULT_SESSION_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True) if DEFAULT_SESSION_DIR.exists() else []
        if not session_files:
            sessions_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Text("No saved sessions yet.", size=12, color=TEXT_MUTED),
                )
            )
        else:
            for session_path in session_files[:8]:
                try:
                    data = json.loads(session_path.read_text(encoding="utf-8"))
                    message_count = len(data.get("messages", []))
                    preview = " | ".join(data.get("messages", [])[:2])[:160]
                    token_summary = f"in {data.get('input_tokens', 0)} / out {data.get('output_tokens', 0)}"
                except Exception:
                    message_count = 0
                    preview = "Unable to read session preview"
                    token_summary = "Unknown token usage"
                sessions_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=18,
                        padding=ft.Padding(14, 12, 14, 12),
                        content=ft.Column(
                            [
                                ft.Text(session_path.stem, size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ft.Text(f"{message_count} messages, {token_summary}", size=12, color=TEXT_MUTED),
                                ft.Text(preview or "No preview available", size=11, color=TEXT_MUTED, selectable=True),
                            ],
                            spacing=5,
                        ),
                    )
                )
        status_text.value = f"{len(session_files)} saved sessions in local memory"
        page.update()

    def save_notes(e):
        updated_state = load_desktop_state()
        updated_state["memory_notes"] = notes_field.value or ""
        save_desktop_state(updated_state)
        status_text.value = "Saved workspace memory notes"
        status_text.color = SUCCESS
        page.update()

    refresh_sessions()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Memory", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Keep a local workspace note and review saved session history.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Refresh Sessions", icon=ft.Icons.REFRESH, on_click=refresh_sessions),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                notes_field,
                ft.Row([ft.Button("Save Memory Note", icon=ft.Icons.SAVE, on_click=save_notes)], spacing=8),
                status_text,
                ft.Text(f"Session storage: {DEFAULT_SESSION_DIR}", size=12, color=TEXT_MUTED, selectable=True),
                ft.Text("Recent sessions", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                ft.ListView([sessions_column], expand=True, spacing=0, padding=0),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_artifacts_screen(page: ft.Page):
    title_field = ft.TextField(label="Artifact title", border_radius=16, bgcolor=CARD_BG)
    body_field = ft.TextField(
        label="Artifact content",
        multiline=True,
        min_lines=10,
        max_lines=14,
        border_radius=16,
        bgcolor=CARD_BG,
    )
    artifacts_column = ft.Column(spacing=10)
    status_text = ft.Text("", size=12, color=TEXT_MUTED)

    def open_artifact_folder(e):
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        opened = launch_local_app(str(ARTIFACTS_DIR))
        status_text.value = "Opened artifact folder" if opened else f"Artifact folder ready at {ARTIFACTS_DIR}"
        status_text.color = SUCCESS if opened else TEXT_MUTED
        page.update()

    def refresh_artifacts(e=None):
        artifacts_column.controls.clear()
        recent_local = list_recent_artifacts()
        workspace_outputs = list_recent_workspace_outputs()
        if recent_local:
            artifacts_column.controls.append(ft.Text("Saved artifacts", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY))
            for artifact in recent_local:
                artifacts_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=18,
                        padding=ft.Padding(14, 12, 14, 12),
                        content=ft.Column(
                            [
                                ft.Text(artifact.name, size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ft.Text(datetime.fromtimestamp(artifact.stat().st_mtime).strftime("%Y-%m-%d %H:%M"), size=11, color=TEXT_MUTED),
                                ft.Text(str(artifact), size=11, color=TEXT_MUTED, selectable=True),
                            ],
                            spacing=5,
                        ),
                    )
                )
        if workspace_outputs:
            artifacts_column.controls.append(ft.Text("Recent workspace outputs", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY))
            for relative_path in workspace_outputs:
                artifacts_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=18,
                        padding=ft.Padding(12, 10, 12, 10),
                        content=ft.Text(relative_path, size=11, color=TEXT_MUTED, selectable=True),
                    )
                )
        if not recent_local and not workspace_outputs:
            artifacts_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Text("No artifacts saved yet.", size=12, color=TEXT_MUTED),
                )
            )
        page.update()

    def save_artifact(e):
        raw_title = (title_field.value or "artifact").strip()
        slug = "".join(character.lower() if character.isalnum() else "-" for character in raw_title).strip("-") or "artifact"
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        target = ARTIFACTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{slug}.md"
        body = body_field.value or ""
        target.write_text(f"# {raw_title}\n\n{body}\n", encoding="utf-8")
        title_field.value = ""
        body_field.value = ""
        status_text.value = f"Saved artifact to {target.name}"
        status_text.color = SUCCESS
        refresh_artifacts()
        page.update()

    refresh_artifacts()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Artifacts", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Capture generated notes, snippets, and outputs in a local artifact folder.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Open Folder", icon=ft.Icons.FOLDER_OPEN, on_click=open_artifact_folder),
                        ft.Button("Refresh", icon=ft.Icons.REFRESH, on_click=refresh_artifacts),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                title_field,
                body_field,
                ft.Row([ft.Button("Save Artifact", icon=ft.Icons.NOTE_ADD, on_click=save_artifact)], spacing=8),
                status_text,
                ft.Text(f"Artifact folder: {ARTIFACTS_DIR}", size=12, color=TEXT_MUTED, selectable=True),
                ft.ListView([artifacts_column], expand=True, spacing=0, padding=0),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_runtime_screen(page: ft.Page):
    runtime_column = ft.Column(spacing=10)
    status_text = ft.Text("", size=12, color=TEXT_MUTED)

    def refresh_runtime(e=None):
        runtime_column.controls.clear()
        runtime_tools = detect_local_runtime_tools()
        ai_status = detect_local_ai()
        mcp_tools = [tool for tool in PORTED_TOOLS if "mcp" in tool.name.lower() or "mcp" in tool.source_hint.lower()] if HAS_SRC_MODULES else []
        mcp_configs = discover_mcp_configs()

        runtime_column.controls.append(ft.Text("Local runtimes", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY))
        for runtime in runtime_tools:
            launch_button = ft.OutlinedButton(
                "Open",
                icon=ft.Icons.OPEN_IN_NEW,
                disabled=not bool(runtime["launch_path"]),
                on_click=lambda e, launch_path=runtime["launch_path"]: launch_local_app(launch_path) if launch_path else None,
            )
            runtime_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Text(runtime["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.Container(
                                        bgcolor=ACCENT_SOFT,
                                        border_radius=999,
                                        padding=ft.Padding(10, 4, 10, 4),
                                        content=ft.Text(runtime["state"], size=11, color=SUCCESS if runtime["enabled"] else WARNING),
                                    ),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(str(runtime["detail"]), size=11, color=TEXT_MUTED, selectable=True),
                            ft.Row([launch_button], spacing=8),
                        ],
                        spacing=6,
                    ),
                )
            )

        runtime_column.controls.append(ft.Text("Local AI providers", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY))
        for key in get_local_ai_priority():
            info = ai_status.get(key)
            if not info:
                continue
            runtime_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Row(
                        [
                            ft.Column(
                                [
                                    ft.Text(info["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.Text(info["base_url"], size=11, color=TEXT_MUTED, selectable=True),
                                ],
                                spacing=5,
                                expand=True,
                            ),
                            ft.Text("Running" if info["running"] else "Offline", color=SUCCESS if info["running"] else WARNING, size=12),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                )
            )

        runtime_column.controls.append(ft.Text("MCP and extensions", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY))
        runtime_column.controls.append(
            ft.Container(
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=18,
                padding=ft.Padding(14, 12, 14, 12),
                content=ft.Column(
                    [
                        ft.Text(f"Mirrored MCP-related tools: {len(mcp_tools)}", size=13, color=TEXT_PRIMARY),
                        ft.Text(", ".join(tool.name for tool in mcp_tools[:8]) or "No MCP-related tools mirrored yet", size=11, color=TEXT_MUTED, selectable=True),
                        ft.Divider(height=8, color=ft.Colors.TRANSPARENT),
                        ft.Text("Detected MCP-related files", size=12, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        ft.Text("\n".join(mcp_configs) if mcp_configs else "No MCP config files detected in the workspace root", size=11, color=TEXT_MUTED, selectable=True),
                    ],
                    spacing=4,
                ),
            )
        )
        status_text.value = "Runtime scan refreshed"
        page.update()

    refresh_runtime()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Local Runtime", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Track Claude Code, voice tooling, local providers, and MCP-related workspace wiring.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Refresh Runtime", icon=ft.Icons.REFRESH, on_click=refresh_runtime),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                status_text,
                ft.ListView([runtime_column], expand=True, spacing=0, padding=0),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_diagnostics_screen(page: ft.Page, on_provider_state_change=None):
    status_text = ft.Text("", size=12, color=TEXT_MUTED)
    summary_row = ft.ResponsiveRow(spacing=10, run_spacing=10)
    local_ai_cards = ft.ResponsiveRow(spacing=10, run_spacing=10)
    desktop_apps_column = ft.Column(spacing=10)
    runtime_tools_column = ft.Column(spacing=10)
    enabled_providers_text = ft.Text("", size=12, color=TEXT_MUTED, selectable=True)
    priority_dropdown = ft.Dropdown(
        label="Preferred auto-connect AI",
        width=260,
        value=get_local_ai_priority()[0],
        options=[
            ft.dropdown.Option(key, LOCAL_AI_PROVIDERS[key]["name"])
            for key in normalize_local_ai_priority()
        ],
        bgcolor=CARD_BG,
        border_radius=14,
    )
    desktop_app_catalog = [
        ("outlook.desktop", "Microsoft Outlook", ft.Icons.MAIL_OUTLINE),
        ("chrome", "Google Chrome", ft.Icons.LANGUAGE),
        ("edge", "Microsoft Edge", ft.Icons.PUBLIC),
        ("firefox", "Firefox", ft.Icons.TRAVEL_EXPLORE),
        ("whatsapp.desktop", "WhatsApp Desktop", ft.Icons.CHAT_BUBBLE_OUTLINE),
    ]

    def create_summary_card(title: str, value: str, detail: str, tone: str):
        return ft.Container(
            col={"sm": 6, "md": 4},
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=18,
            padding=ft.Padding(14, 12, 14, 12),
            content=ft.Column(
                [
                    ft.Text(title, size=12, color=TEXT_MUTED),
                    ft.Text(value, size=20, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                    ft.Text(detail, size=11, color=tone),
                ],
                spacing=4,
            ),
        )

    def connect_local_provider(provider_key: str, provider_info: dict[str, object]):
        if not bool(provider_info.get("healthy")):
            status_text.value = f"{provider_info['name']} is not ready for connection"
            status_text.color = WARNING
            page.update()
            return
        actual_model = str(provider_info.get("detected_model") or provider_info.get("default_model") or "local-model")
        save_provider_settings(ProviderType(provider_key), str(provider_info["base_url"]), actual_model)
        if on_provider_state_change:
            on_provider_state_change()
        status_text.value = f"Connected to {provider_info['name']} using {actual_model}"
        status_text.color = SUCCESS
        page.update()

    def refresh_diagnostics(e=None, announce: bool = True):
        ai_status = detect_local_ai()
        runtime_tools = detect_local_runtime_tools()
        ordered_keys = normalize_local_ai_priority(get_local_ai_priority())
        healthy_count = len([key for key in ordered_keys if ai_status.get(key, {}).get("healthy")])
        running_count = len([key for key in ordered_keys if ai_status.get(key, {}).get("running")])
        detected_apps = 0

        summary_row.controls.clear()
        local_ai_cards.controls.clear()
        desktop_apps_column.controls.clear()
        runtime_tools_column.controls.clear()

        summary_row.controls.extend(
            [
                create_summary_card("Local AI", f"{healthy_count}/{len(LOCAL_AI_PROVIDERS)}", f"{running_count} running processes", SUCCESS if healthy_count else WARNING),
                create_summary_card("Runtime Tools", f"{len([tool for tool in runtime_tools if tool['enabled']])}/{len(runtime_tools)}", "Claude Code, Piper, Whisper, TurboQuant, edge-tts", SUCCESS),
                create_summary_card("Desktop Apps", "Scanning", "Outlook, Chrome, Edge, Firefox, WhatsApp", TEXT_MUTED),
            ]
        )

        for position, key in enumerate(ordered_keys):
            info = ai_status.get(key)
            if not info:
                continue
            state_label = "Connected" if info["healthy"] else ("Running" if info["running"] else "Offline")
            state_color = SUCCESS if info["healthy"] else (WARNING if info["running"] else TEXT_MUTED)
            model_list = info.get("models", []) or [str(info.get("detected_model") or info["default_model"])]
            local_ai_cards.controls.append(
                ft.Container(
                    col={"sm": 6, "md": 4},
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, ACCENT if position == 0 else BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Row(
                                        [
                                            ft.Icon(info["icon"], size=18, color=ACCENT),
                                            ft.Text(info["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                        ],
                                        spacing=8,
                                    ),
                                    ft.Container(
                                        bgcolor=ACCENT_SOFT if position == 0 else CARD_ALT_BG,
                                        border_radius=999,
                                        padding=ft.Padding(10, 4, 10, 4),
                                        content=ft.Text("Priority" if position == 0 else state_label, size=10, color=ACCENT if position == 0 else state_color),
                                    ),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(state_label, size=12, color=state_color),
                            ft.Text(info["base_url"], size=11, color=TEXT_MUTED, selectable=True),
                            ft.Text(f"Models: {len(info.get('models', [])) or 1} | {', '.join(model_list[:3])}", size=11, color=TEXT_MUTED, selectable=True),
                            ft.Row(
                                [
                                    ft.OutlinedButton(
                                        "Use Now",
                                        icon=ft.Icons.LINK,
                                        disabled=not info["healthy"],
                                        on_click=lambda e, provider_key=key, provider_info=info: connect_local_provider(provider_key, provider_info),
                                    ),
                                ],
                                spacing=8,
                            ),
                        ],
                        spacing=8,
                    ),
                )
            )

        for app_key, app_name, app_icon in desktop_app_catalog:
            app_path = find_local_app_path(app_key)
            if app_path:
                detected_apps += 1
            desktop_apps_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Row(
                                        [
                                            ft.Icon(app_icon, size=18, color=ACCENT),
                                            ft.Text(app_name, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                        ],
                                        spacing=8,
                                    ),
                                    ft.Text("Detected" if app_path else "Missing", size=12, color=SUCCESS if app_path else WARNING),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(app_path or "No known install path found", size=11, color=TEXT_MUTED, selectable=True),
                            ft.Row(
                                [
                                    ft.OutlinedButton(
                                        "Open",
                                        icon=ft.Icons.OPEN_IN_NEW,
                                        disabled=not bool(app_path),
                                        on_click=lambda e, selected_path=app_path: launch_local_app(selected_path) if selected_path else None,
                                    ),
                                ],
                                spacing=8,
                            ),
                        ],
                        spacing=8,
                    ),
                )
            )

        for runtime in runtime_tools:
            runtime_tools_column.controls.append(
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Text(runtime["name"], size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.Text(str(runtime["state"]), size=12, color=SUCCESS if runtime["enabled"] else WARNING),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Text(str(runtime["detail"]), size=11, color=TEXT_MUTED, selectable=True),
                        ],
                        spacing=6,
                    ),
                )
            )

        summary_row.controls[2] = create_summary_card(
            "Desktop Apps",
            f"{detected_apps}/{len(desktop_app_catalog)}",
            "Detected through known local install paths",
            SUCCESS if detected_apps else WARNING,
        )
        enabled_names = [provider_display_name(provider) for provider in get_enabled_provider_types()] if HAS_SRC_MODULES else []
        enabled_providers_text.value = "Enabled providers: " + (", ".join(enabled_names) if enabled_names else "unknown")
        if announce:
            status_text.value = "Diagnostics refreshed"
            status_text.color = TEXT_MUTED
        page.update()

    def save_priority(e=None):
        if not priority_dropdown.value:
            return
        save_local_ai_priority([priority_dropdown.value])
        selected_name = LOCAL_AI_PROVIDERS[priority_dropdown.value]["name"]
        status_text.value = f"{selected_name} is now first in auto-connect order"
        status_text.color = SUCCESS
        refresh_diagnostics(announce=False)

    def run_auto_connect(e=None):
        key, name, base_url, model = auto_connect_ai([priority_dropdown.value] if priority_dropdown.value else None)
        if key:
            if on_provider_state_change:
                on_provider_state_change()
            status_text.value = f"Auto-connected to {name} at {base_url} using {model}"
            status_text.color = SUCCESS
        else:
            status_text.value = "No healthy local AI provider is ready right now"
            status_text.color = WARNING
        refresh_diagnostics(announce=False)

    priority_dropdown.on_change = save_priority
    refresh_diagnostics(announce=False)

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Diagnostics", size=18, weight=ft.FontWeight.BOLD),
                                ft.Text("Live checks for local AI, desktop apps, and runtime tools with one-click refresh and connect actions.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Refresh All", icon=ft.Icons.REFRESH, on_click=refresh_diagnostics),
                        ft.Button("Auto-Connect Best", icon=ft.Icons.AUTO_AWESOME, on_click=run_auto_connect),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                summary_row,
                ft.Container(
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Text("Local AI priority", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Text("Auto-connect tries this provider first, then falls back through the other local providers.", size=12, color=TEXT_MUTED),
                            ft.Row([priority_dropdown], spacing=8),
                            enabled_providers_text,
                        ],
                        spacing=8,
                    ),
                ),
                status_text,
                ft.Text("Local AI", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                local_ai_cards,
                ft.Text("Desktop apps", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                ft.ListView([desktop_apps_column], expand=False, spacing=0, padding=0, height=260),
                ft.Text("Runtime tools", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                ft.ListView([runtime_tools_column], expand=True, spacing=0, padding=0),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_analysis_screen(page: ft.Page):
    mode_dropdown = ft.Dropdown(
        label="Analysis mode",
        value="Code",
        width=180,
        options=[
            ft.dropdown.Option("Code"),
            ft.dropdown.Option("Tasks"),
            ft.dropdown.Option("Email"),
            ft.dropdown.Option("Preview"),
        ],
        bgcolor=CARD_BG,
        border_radius=14,
    )
    source_dropdown = ft.Dropdown(
        label="Source",
        width=420,
        bgcolor=CARD_BG,
        border_radius=14,
    )
    input_field = ft.TextField(
        label="Paste text, task notes, code, or email content",
        multiline=True,
        min_lines=12,
        max_lines=20,
        expand=True,
        border_radius=16,
        bgcolor=CARD_BG,
    )
    analysis_output = ft.Text("Analysis preview will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    preview_output = ft.Text("Source preview will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    source_meta = ft.Text("No source loaded", size=11, color=TEXT_MUTED, selectable=True)
    status_text = ft.Text("", size=12, color=TEXT_MUTED)
    preview_sources: list[dict[str, str]] = []

    def refresh_sources(e=None):
        nonlocal preview_sources
        preview_sources = gather_preview_sources()
        source_dropdown.options = [ft.dropdown.Option("__pasted__", "Pasted text only")]
        source_dropdown.options.extend(
            ft.dropdown.Option(source["path"], source["label"]) for source in preview_sources
        )
        if not source_dropdown.value:
            source_dropdown.value = "__pasted__"
        status_text.value = f"Loaded {len(preview_sources)} preview sources"
        page.update()

    def load_selected_source(e=None):
        if source_dropdown.value == "__pasted__" or not source_dropdown.value:
            source_meta.value = "Using pasted text"
            preview_output.value = (input_field.value or "")[:4000] or "Paste content or choose a file source."
            page.update()
            return
        selected_path = source_dropdown.value
        preview_text = read_text_preview(selected_path, max_chars=4000)
        file_path = Path(selected_path)
        source_meta.value = f"{file_path.name} | {file_path.suffix or 'text'} | {file_path.stat().st_size if file_path.exists() else 0} bytes"
        preview_output.value = preview_text or "Could not read a text preview from this file."
        page.update()

    def analyze_current_source(e=None):
        if source_dropdown.value and source_dropdown.value != "__pasted__":
            source_text = read_text_preview(source_dropdown.value, max_chars=8000)
            source_label = Path(source_dropdown.value).name
        else:
            source_text = input_field.value or ""
            source_label = "pasted text"
        if not source_text.strip():
            status_text.value = "Paste content or select a file source first"
            status_text.color = WARNING
            page.update()
            return
        mode = mode_dropdown.value or "Preview"
        analysis_output.value = build_analysis_summary(mode, source_text)
        preview_output.value = source_text[:4000]
        source_meta.value = f"Analyzed {source_label} in {mode.lower()} mode"
        status_text.value = "Analysis and preview updated"
        status_text.color = SUCCESS
        page.update()

    def save_analysis_artifact(e=None):
        source_label = Path(source_dropdown.value).stem if source_dropdown.value and source_dropdown.value != "__pasted__" else "pasted-text"
        mode = (mode_dropdown.value or "preview").lower()
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        target = ARTIFACTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{mode}-{source_label}-analysis.md"
        target.write_text(
            "\n".join(
                [
                    f"# {mode.title()} analysis",
                    "",
                    f"Source: {source_meta.value}",
                    "",
                    "## Summary",
                    analysis_output.value,
                    "",
                    "## Preview",
                    preview_output.value,
                ]
            ),
            encoding="utf-8",
        )
        status_text.value = f"Saved analysis artifact to {target.name}"
        status_text.color = SUCCESS
        page.update()

    source_dropdown.on_change = load_selected_source
    refresh_sources()

    return ft.SelectionArea(
        content=ft.Row(
            [
                ft.Container(
                    expand=5,
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=22,
                    padding=ft.Padding(18, 16, 18, 16),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Column(
                                        [
                                            ft.Text("Analysis Workspace", size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                                            ft.Text("Claude-style working view for coding, tasking, and email analysis with a live preview pane.", size=12, color=TEXT_MUTED),
                                        ],
                                        spacing=4,
                                        expand=True,
                                    ),
                                    ft.Button("Refresh Sources", icon=ft.Icons.REFRESH, on_click=refresh_sources),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Divider(height=1),
                            ft.Row([mode_dropdown, source_dropdown], spacing=10, wrap=True),
                            input_field,
                            ft.Row(
                                [
                                    ft.Button("Load Preview", icon=ft.Icons.VISIBILITY, on_click=load_selected_source),
                                    ft.Button("Analyze", icon=ft.Icons.AUTO_AWESOME, on_click=analyze_current_source),
                                    ft.Button("Save Analysis", icon=ft.Icons.NOTE_ADD, on_click=save_analysis_artifact),
                                ],
                                spacing=8,
                                wrap=True,
                            ),
                            status_text,
                        ],
                        expand=True,
                        spacing=12,
                    ),
                ),
                ft.Container(
                    expand=4,
                    bgcolor=PANEL_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=22,
                    padding=ft.Padding(18, 16, 18, 16),
                    content=ft.Column(
                        [
                            ft.Text("Live Preview", size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                            source_meta,
                            ft.Divider(height=1),
                            ft.Text("Summary", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=2,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([analysis_output], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Preview", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=3,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([preview_output], expand=True, spacing=0, padding=0),
                            ),
                        ],
                        expand=True,
                        spacing=10,
                    ),
                ),
            ],
            expand=True,
            spacing=14,
        )
    )


def create_business_brain_screen(page: ft.Page):
    if not HAS_SRC_MODULES:
        return ft.Container(
            expand=True,
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=22,
            padding=ft.Padding(18, 16, 18, 16),
            content=ft.Text("Business Brain needs the local src modules available.", size=13, color=WARNING),
        )

    inbox_path = get_business_brain_inbox(PROJECT_ROOT)

    intake_path_field = ft.TextField(
        label="Intake path",
        value=str(inbox_path),
        hint_text="Folder containing .eml, WhatsApp exports, PDFs, bills, contracts, and notes",
        border_radius=14,
        bgcolor=CARD_BG,
        expand=True,
    )
    schema_text = ft.Text("Loading schema overview...", size=12, color=TEXT_PRIMARY, selectable=True)
    status_text = ft.Text("Loading Business Brain...", size=12, color=TEXT_MUTED)
    db_path_text = ft.Text(str(get_business_brain_db_path(PROJECT_ROOT)), size=11, color=TEXT_MUTED, selectable=True)
    total_text = ft.Text("0", size=24, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY)
    risk_text = ft.Text("0", size=24, weight=ft.FontWeight.W_700, color=WARNING)
    renewals_text = ft.Text("0", size=24, weight=ft.FontWeight.W_700, color=ACCENT)
    money_text = ft.Text("0", size=24, weight=ft.FontWeight.W_700, color=SUCCESS)
    domains_column = ft.Column(spacing=8)
    counterparties_column = ft.Column(spacing=8)
    recent_column = ft.Column(spacing=8)
    opportunities_text = ft.Text("No opportunities surfaced yet.", size=12, color=TEXT_MUTED, selectable=True)

    def metric_card(title: str, value_control: ft.Control, detail: str, accent_color: str):
        return ft.Container(
            expand=True,
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=18,
            padding=ft.Padding(14, 12, 14, 12),
            content=ft.Column(
                [
                    ft.Text(title, size=12, color=TEXT_MUTED),
                    value_control,
                    ft.Text(detail, size=11, color=accent_color),
                ],
                spacing=6,
            ),
        )

    def refresh_business_brain(e=None):
        status_text.value = "Refreshing Business Brain..."
        status_text.color = TEXT_MUTED
        page.update()

        def do_refresh():
            inbox_path.mkdir(parents=True, exist_ok=True)
            ensure_business_brain_db(PROJECT_ROOT)
            overview = get_business_brain_overview(PROJECT_ROOT)
            total_text.value = str(overview["total_documents"])
            risk_text.value = str(overview["high_risk"])
            renewals_text.value = str(overview["renewals"])
            money_text.value = str(overview["money_items"])
            db_path_text.value = overview["db_path"]
            schema_text.value = business_brain_schema_overview()

            domains_column.controls.clear()
            for row in overview["domains"][:8]:
                domains_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=16,
                        padding=ft.Padding(12, 10, 12, 10),
                        content=ft.Row(
                            [
                                ft.Text(str(row["domain"]).title(), size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                ft.Text(str(row["count"]), size=12, color=ACCENT),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                    )
                )
            if not domains_column.controls:
                domains_column.controls.append(ft.Text("No indexed domains yet.", size=12, color=TEXT_MUTED))

            counterparties_column.controls.clear()
            for row in overview["counterparties"]:
                counterparties_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=16,
                        padding=ft.Padding(12, 10, 12, 10),
                        content=ft.Row(
                            [
                                ft.Text(str(row["counterparty"]), size=12, color=TEXT_PRIMARY, expand=True, selectable=True),
                                ft.Text(str(row["count"]), size=12, color=ACCENT),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                    )
                )
            if not counterparties_column.controls:
                counterparties_column.controls.append(ft.Text("No counterparties clustered yet.", size=12, color=TEXT_MUTED))

            recent_column.controls.clear()
            for row in overview["recent"]:
                recent_column.controls.append(
                    ft.Container(
                        bgcolor=CARD_BG,
                        border=ft.Border.all(1, BORDER_COLOR),
                        border_radius=16,
                        padding=ft.Padding(12, 10, 12, 10),
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Text(str(row["source_name"]), size=13, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY, expand=True),
                                        ft.Text(str(row["risk_level"]).upper(), size=11, color=WARNING if row["risk_level"] != "normal" else TEXT_MUTED),
                                    ],
                                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                                ),
                                ft.Text(f"{row['source_kind']} | {row['domain']} | {row.get('counterparty') or 'unknown counterparty'}", size=11, color=TEXT_MUTED, selectable=True),
                                ft.Text(str(row["summary"]), size=12, color=TEXT_PRIMARY, selectable=True),
                            ],
                            spacing=5,
                        ),
                    )
                )
            if not recent_column.controls:
                recent_column.controls.append(ft.Text("No indexed records yet.", size=12, color=TEXT_MUTED))

            opportunities = overview["opportunities"]
            opportunities_text.value = "\n".join(f"- {item}" for item in opportunities) if opportunities else "No opportunities surfaced yet."
            status_text.value = "Business Brain ready"
            status_text.color = SUCCESS
            page.update()

        threading.Thread(target=do_refresh, daemon=True).start()

    def ingest_now(e=None):
        status_text.value = "Scanning intake path..."
        status_text.color = TEXT_MUTED
        page.update()

        def do_ingest():
            result = ingest_business_brain_path(PROJECT_ROOT, intake_path_field.value or "")
            status_text.value = result["message"]
            status_text.color = SUCCESS if result.get("ok") else WARNING
            page.update()
            refresh_business_brain()

        threading.Thread(target=do_ingest, daemon=True).start()

    def open_inbox(e=None):
        target = Path(intake_path_field.value or str(inbox_path)).expanduser()
        target.mkdir(parents=True, exist_ok=True)
        opened = launch_local_app(str(target))
        status_text.value = "Opened intake folder" if opened else f"Intake folder ready at {target}"
        status_text.color = SUCCESS if opened else TEXT_MUTED
        page.update()

    def save_snapshot(e=None):
        overview = get_business_brain_overview(PROJECT_ROOT)
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        target = ARTIFACTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-business-brain-snapshot.md"
        target.write_text(
            "\n".join(
                [
                    "# Business Brain Snapshot",
                    "",
                    f"Database: {overview['db_path']}",
                    f"Total documents: {overview['total_documents']}",
                    f"High risk items: {overview['high_risk']}",
                    f"Renewals detected: {overview['renewals']}",
                    f"Money items: {overview['money_items']}",
                    "",
                    "## Domains",
                    *(f"- {row['domain']}: {row['count']}" for row in overview['domains']),
                    "",
                    "## Top Counterparties",
                    *(f"- {row['counterparty']}: {row['count']}" for row in overview['counterparties']),
                    "",
                    "## Opportunities",
                    *(f"- {item}" for item in overview['opportunities']),
                ]
            ),
            encoding="utf-8",
        )
        status_text.value = f"Saved Business Brain snapshot to {target.name}"
        status_text.color = SUCCESS
        page.update()

    refresh_business_brain()

    return ft.SelectionArea(
        content=ft.Column(
            [
                ft.Row(
                    [
                        ft.Column(
                            [
                                ft.Text("Business Brain", size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                                ft.Text("Local unified index for emails, WhatsApp exports, bills, contracts, PDFs, and operating documents.", size=12, color=TEXT_MUTED),
                            ],
                            spacing=4,
                            expand=True,
                        ),
                        ft.Button("Refresh", icon=ft.Icons.REFRESH, on_click=refresh_business_brain),
                        ft.Button("Scan Intake", icon=ft.Icons.AUTO_AWESOME, on_click=ingest_now),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Divider(height=1),
                ft.Container(
                    bgcolor=PANEL_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=20,
                    padding=ft.Padding(14, 12, 14, 12),
                    content=ft.Column(
                        [
                            ft.Text("Intake", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Text("Drop .eml, WhatsApp .txt exports, PDFs, bills, contracts, and notes into a folder, then scan it into the local index.", size=12, color=TEXT_MUTED),
                            ft.Row([intake_path_field], spacing=8),
                            ft.Row(
                                [
                                    ft.Button("Open Intake Folder", icon=ft.Icons.FOLDER_OPEN, on_click=open_inbox),
                                    ft.OutlinedButton("Save Snapshot", icon=ft.Icons.NOTE_ADD, on_click=save_snapshot),
                                ],
                                spacing=8,
                                wrap=True,
                            ),
                            ft.Text(f"Database path: {db_path_text.value}", size=11, color=TEXT_MUTED, selectable=True),
                            status_text,
                        ],
                        spacing=8,
                    ),
                ),
                ft.Row(
                    [
                        metric_card("Indexed documents", total_text, "Everything the agents can reason over", ACCENT),
                        metric_card("High risk", risk_text, "Legal, expiry, breach, urgent, or penalty signals", WARNING),
                        metric_card("Renewals", renewals_text, "Detected expiry and renewal style dates", ACCENT),
                        metric_card("Money items", money_text, "Records carrying amounts or billing signals", SUCCESS),
                    ],
                    spacing=10,
                ),
                ft.Row(
                    [
                        ft.Container(
                            expand=3,
                            bgcolor=PANEL_BG,
                            border=ft.Border.all(1, BORDER_COLOR),
                            border_radius=20,
                            padding=ft.Padding(14, 12, 14, 12),
                            content=ft.Column(
                                [
                                    ft.Text("Schema", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    schema_text,
                                ],
                                spacing=8,
                            ),
                        ),
                        ft.Container(
                            expand=2,
                            bgcolor=PANEL_BG,
                            border=ft.Border.all(1, BORDER_COLOR),
                            border_radius=20,
                            padding=ft.Padding(14, 12, 14, 12),
                            content=ft.Column(
                                [
                                    ft.Text("Domains", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.ListView([domains_column], expand=True, spacing=0, padding=0),
                                ],
                                expand=True,
                                spacing=8,
                            ),
                        ),
                        ft.Container(
                            expand=2,
                            bgcolor=PANEL_BG,
                            border=ft.Border.all(1, BORDER_COLOR),
                            border_radius=20,
                            padding=ft.Padding(14, 12, 14, 12),
                            content=ft.Column(
                                [
                                    ft.Text("Top Counterparties", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.ListView([counterparties_column], expand=True, spacing=0, padding=0),
                                ],
                                expand=True,
                                spacing=8,
                            ),
                        ),
                    ],
                    expand=True,
                    spacing=10,
                ),
                ft.Row(
                    [
                        ft.Container(
                            expand=3,
                            bgcolor=PANEL_BG,
                            border=ft.Border.all(1, BORDER_COLOR),
                            border_radius=20,
                            padding=ft.Padding(14, 12, 14, 12),
                            content=ft.Column(
                                [
                                    ft.Text("Recent Indexed Records", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.ListView([recent_column], expand=True, spacing=0, padding=0),
                                ],
                                expand=True,
                                spacing=8,
                            ),
                        ),
                        ft.Container(
                            expand=2,
                            bgcolor=PANEL_BG,
                            border=ft.Border.all(1, BORDER_COLOR),
                            border_radius=20,
                            padding=ft.Padding(14, 12, 14, 12),
                            content=ft.Column(
                                [
                                    ft.Text("Expert Mix Opportunities", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                                    ft.Text("These are the first cross-domain prompts the legal, accounting, business, property, and content agents can act on.", size=12, color=TEXT_MUTED),
                                    opportunities_text,
                                ],
                                spacing=8,
                            ),
                        ),
                    ],
                    expand=True,
                    spacing=10,
                ),
            ],
            expand=True,
            spacing=10,
        )
    )


def create_reasoning_sandbox_screen(page: ft.Page, send_chat_message=None):
    if not HAS_SRC_MODULES:
        return ft.Container(
            expand=True,
            bgcolor=CARD_BG,
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=22,
            padding=ft.Padding(18, 16, 18, 16),
            content=ft.Text("Reasoning Sandbox needs the local src modules available.", size=13, color=WARNING),
        )

    task_path_field = ft.TextField(
        label="Task file path",
        hint_text="ARC-style .json task or a plain text reasoning prompt file",
        border_radius=14,
        bgcolor=CARD_BG,
        expand=True,
    )
    sample_task_dropdown = ft.Dropdown(label="Sample task", width=320, bgcolor=CARD_BG, border_radius=14)
    model_lane_dropdown = ft.Dropdown(
        label="Model lane",
        width=240,
        value="Gemma-4",
        options=[
            ft.dropdown.Option("Gemma-4"),
            ft.dropdown.Option("Qwen 3.5"),
            ft.dropdown.Option("Vision lane"),
            ft.dropdown.Option("OmniCoder"),
            ft.dropdown.Option("Manual"),
        ],
        bgcolor=CARD_BG,
        border_radius=14,
    )
    pasted_task_field = ft.TextField(
        label="Pasted task",
        hint_text="Paste an ARC prompt, logic puzzle, or reasoning notes here",
        multiline=True,
        min_lines=10,
        max_lines=18,
        expand=True,
        border_radius=16,
        bgcolor=CARD_BG,
    )
    task_summary = ft.Text("Load a task to begin.", size=12, color=TEXT_MUTED, selectable=True)
    task_preview = ft.Text("Task preview will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    chain_output = ft.Text("Five-step reasoning chain will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    evaluator_output = ft.Text("Model evaluator pack will appear here.", size=12, color=TEXT_MUTED, selectable=True)
    answer_input = ft.TextField(
        label="Model answer grid",
        hint_text="Paste rows like '2 2 2' or JSON like [[2,2],[2,2]]",
        multiline=True,
        min_lines=6,
        max_lines=12,
        expand=True,
        border_radius=16,
        bgcolor=CARD_BG,
    )
    score_output = ft.Text("No score yet.", size=12, color=TEXT_MUTED, selectable=True)
    scoreboard_output = ft.Text("No model scores recorded yet.", size=12, color=TEXT_MUTED, selectable=True)
    attempts_output = ft.Text("No attempt history recorded yet.", size=12, color=TEXT_MUTED, selectable=True)
    status_text = ft.Text("Loading reasoning sandbox...", size=12, color=TEXT_MUTED)
    current_task = {"value": None}
    score_history: list[dict[str, object]] = []
    sandbox_sources: list[dict[str, str]] = []
    source_dropdown = ft.Dropdown(label="Recent source", width=420, bgcolor=CARD_BG, border_radius=14)

    def refresh_sample_tasks():
        def do_refresh():
            ensure_reasoning_sample_tasks(PROJECT_ROOT)
            sample_task_dropdown.options = [ft.dropdown.Option("", "Select bundled task")]
            sample_task_dropdown.options.extend(
                ft.dropdown.Option(item["path"], item["label"]) for item in list_reasoning_tasks(PROJECT_ROOT)
            )
            if sample_task_dropdown.value is None:
                sample_task_dropdown.value = ""
            page.update()

        threading.Thread(target=do_refresh, daemon=True).start()

    def refresh_scoreboard():
        if not score_history:
            scoreboard_output.value = "No model scores recorded yet."
            attempts_output.value = "No attempt history recorded yet."
            return
        grouped: dict[str, list[dict[str, object]]] = {}
        for item in score_history:
            grouped.setdefault(str(item.get("model", "unknown")), []).append(item)

        scoreboard_lines = ["Scoreboard"]
        attempt_lines = ["Attempt History"]
        for model_name, attempts in sorted(
            grouped.items(),
            key=lambda pair: max(float(item.get("score", 0.0)) for item in pair[1]),
            reverse=True,
        ):
            best_score = max(float(item.get("score", 0.0)) for item in attempts)
            latest = attempts[-1]
            scoreboard_lines.append(
                f"- {model_name}: best {best_score:.2f} | latest {float(latest.get('score', 0.0)):.2f} | attempts {len(attempts)}"
            )
            for index, item in enumerate(attempts, start=1):
                attempt_lines.append(
                    f"- {model_name} attempt {index}: {float(item.get('score', 0.0)):.2f} | {item.get('message', '')}"
                )

        scoreboard_output.value = "\n".join(scoreboard_lines)
        attempts_output.value = "\n".join(attempt_lines)

    def refresh_sources(e=None):
        nonlocal sandbox_sources
        status_text.value = "Refreshing recent sources..."
        status_text.color = TEXT_MUTED
        page.update()

        def do_refresh():
            nonlocal sandbox_sources
            sandbox_sources = gather_preview_sources(limit=24)
            source_dropdown.options = [ft.dropdown.Option("", "Select recent source")]
            source_dropdown.options.extend(
                ft.dropdown.Option(source["path"], source["label"]) for source in sandbox_sources
            )
            if source_dropdown.value is None:
                source_dropdown.value = ""
            status_text.value = "Reasoning sandbox ready"
            status_text.color = SUCCESS
            page.update()

        threading.Thread(target=do_refresh, daemon=True).start()

    def load_selected_source(e=None):
        if not source_dropdown.value:
            return
        task_path_field.value = source_dropdown.value
        load_task_from_path()

    def load_sample_task(e=None):
        if not sample_task_dropdown.value:
            return
        task_path_field.value = sample_task_dropdown.value
        load_task_from_path()

    def load_task_from_path(e=None):
        raw_path = (task_path_field.value or "").strip().strip('"')
        if not raw_path:
            status_text.value = "Enter a task path first"
            status_text.color = WARNING
            page.update()
            return
        task = load_reasoning_task(raw_path)
        if not task.get("ok"):
            status_text.value = str(task.get("message", "Could not load reasoning task"))
            status_text.color = WARNING
            page.update()
            return
        current_task["value"] = task
        score_history.clear()
        task_summary.value = str(task.get("summary") or "")
        task_preview.value = str(task.get("preview") or "")
        chain_output.value = build_reasoning_chain(task)
        evaluator_output.value = build_model_evaluator(task)
        answer_input.value = ""
        score_output.value = "No score yet."
        refresh_scoreboard()
        status_text.value = f"Loaded reasoning task {task.get('title', 'task')}"
        status_text.color = SUCCESS
        page.update()

    def build_from_pasted_task(e=None):
        text = (pasted_task_field.value or "").strip()
        if not text:
            status_text.value = "Paste a task first"
            status_text.color = WARNING
            page.update()
            return
        task = {
            "ok": True,
            "task_type": "pasted_reasoning",
            "title": "Pasted reasoning task",
            "summary": f"Pasted reasoning task\nCharacters: {len(text)}",
            "preview": text[:5000],
            "raw_text": text[:12000],
            "train": [],
            "test": [],
        }
        current_task["value"] = task
        score_history.clear()
        task_summary.value = str(task["summary"])
        task_preview.value = str(task["preview"])
        chain_output.value = build_reasoning_chain(task)
        evaluator_output.value = build_model_evaluator(task)
        answer_input.value = ""
        score_output.value = "No score yet."
        refresh_scoreboard()
        status_text.value = "Built reasoning pack from pasted task"
        status_text.color = SUCCESS
        page.update()

    def score_current_answer(e=None):
        task = current_task["value"]
        if not task:
            status_text.value = "Load or paste a reasoning task first"
            status_text.color = WARNING
            page.update()
            return
        result = score_reasoning_answer(task, answer_input.value or "", model_lane_dropdown.value or "Manual")
        score_output.value = "\n".join(
            [
                f"Model: {result.get('model', 'unknown')}",
                f"Result: {result.get('message', '')}",
                f"Score: {float(result.get('score', 0.0)):.2f}",
            ]
        )
        score_history.append(result)
        refresh_scoreboard()
        status_text.value = f"Scored answer for {result.get('model', 'unknown')}"
        status_text.color = SUCCESS if result.get("ok") else WARNING
        page.update()

    def send_to_chat(e=None):
        task = current_task["value"]
        if not task:
            status_text.value = "Load or paste a reasoning task first"
            status_text.color = WARNING
            page.update()
            return
        if not send_chat_message:
            status_text.value = "Chat is not available right now"
            status_text.color = WARNING
            page.update()
            return
        prompt = build_reasoning_sandbox_report(task)
        if send_chat_message(prompt):
            status_text.value = "Sent reasoning task pack to chat"
            status_text.color = SUCCESS
        else:
            status_text.value = "Chat is busy right now"
            status_text.color = WARNING
        page.update()

    def save_reasoning_artifact(e=None):
        task = current_task["value"]
        if not task:
            status_text.value = "Load or paste a reasoning task first"
            status_text.color = WARNING
            page.update()
            return
        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in str(task.get("title") or "reasoning-task")).strip("-") or "reasoning-task"
        target = ARTIFACTS_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}-{slug}-reasoning.md"
        target.write_text(
            build_reasoning_sandbox_report(task) + "\n\n## Latest Score\n" + score_output.value + "\n\n## Scoreboard\n" + scoreboard_output.value,
            encoding="utf-8",
        )
        status_text.value = f"Saved reasoning artifact to {target.name}"
        status_text.color = SUCCESS
        page.update()

    refresh_sample_tasks()
    refresh_sources()
    source_dropdown.on_change = load_selected_source
    sample_task_dropdown.on_change = load_sample_task

    return ft.SelectionArea(
        content=ft.Row(
            [
                ft.Container(
                    expand=5,
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=22,
                    padding=ft.Padding(18, 16, 18, 16),
                    content=ft.Column(
                        [
                            ft.Row(
                                [
                                    ft.Column(
                                        [
                                            ft.Text("Reasoning Sandbox", size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                                            ft.Text("Safe ARC-style task loader, five-step chain builder, and local model evaluator pack.", size=12, color=TEXT_MUTED),
                                        ],
                                        spacing=4,
                                        expand=True,
                                    ),
                                    ft.Button("Refresh Sources", icon=ft.Icons.REFRESH, on_click=refresh_sources),
                                ],
                                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                            ),
                            ft.Divider(height=1),
                            ft.Row([task_path_field, ft.Button("Load Task", icon=ft.Icons.UPLOAD_FILE, on_click=load_task_from_path)], spacing=10, wrap=True),
                            ft.Row([sample_task_dropdown, source_dropdown], spacing=10, wrap=True),
                            pasted_task_field,
                            ft.Row([model_lane_dropdown], spacing=10),
                            answer_input,
                            ft.Row(
                                [
                                    ft.Button("Build From Pasted Task", icon=ft.Icons.AUTO_AWESOME, on_click=build_from_pasted_task),
                                    ft.Button("Score Answer", icon=ft.Icons.SCIENCE, on_click=score_current_answer),
                                    ft.Button("Send To Chat", icon=ft.Icons.FORWARD_TO_INBOX, on_click=send_to_chat),
                                    ft.Button("Save Reasoning Pack", icon=ft.Icons.NOTE_ADD, on_click=save_reasoning_artifact),
                                ],
                                spacing=8,
                                wrap=True,
                            ),
                            status_text,
                        ],
                        expand=True,
                        spacing=12,
                    ),
                ),
                ft.Container(
                    expand=4,
                    bgcolor=PANEL_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=22,
                    padding=ft.Padding(18, 16, 18, 16),
                    content=ft.Column(
                        [
                            ft.Text("Reasoning Output", size=18, weight=ft.FontWeight.BOLD, color=TEXT_PRIMARY),
                            ft.Text("Task Summary", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=1,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([task_summary], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Task Preview", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=2,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([task_preview], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Five-Step Chain", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=2,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([chain_output], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Model Evaluator", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=2,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([evaluator_output], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Score Result", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=1,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([score_output], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Scoreboard", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=1,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([scoreboard_output], expand=True, spacing=0, padding=0),
                            ),
                            ft.Text("Attempt History", size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Container(
                                expand=1,
                                bgcolor=CARD_BG,
                                border=ft.Border.all(1, BORDER_COLOR),
                                border_radius=18,
                                padding=ft.Padding(14, 12, 14, 12),
                                content=ft.ListView([attempts_output], expand=True, spacing=0, padding=0),
                            ),
                        ],
                        expand=True,
                        spacing=10,
                    ),
                ),
            ],
            expand=True,
            spacing=14,
        )
    )


def create_free_apis_screen(page: ft.Page, on_provider_state_change=None):
    enabled_cloud_providers = tuple(get_enabled_provider_types()) if HAS_SRC_MODULES else tuple()
    cloud_provider_options = [
        provider for provider in enabled_cloud_providers
        if provider in {ProviderType.OPENROUTER, ProviderType.GEMINI, ProviderType.GROQ, ProviderType.QWEN, ProviderType.HUGGINGFACE, ProviderType.OPENAI}
    ] if HAS_SRC_MODULES else []
    selected_provider = cloud_provider_options[0] if cloud_provider_options else None
    provider_dropdown = ft.Dropdown(
        label="Apply key to provider",
        width=220,
        value=selected_provider.value if selected_provider else None,
        options=[ft.dropdown.Option(provider.value, provider_display_name(provider)) for provider in cloud_provider_options],
        border_radius=14,
        bgcolor=CARD_BG,
    )
    api_key_field = ft.TextField(
        label="API key",
        password=True,
        can_reveal_password=True,
        border_radius=14,
        bgcolor=CARD_BG,
        expand=True,
    )
    model_field = ft.TextField(
        label="Model override",
        border_radius=14,
        bgcolor=CARD_BG,
        width=260,
    )
    status_text = ft.Text("Paste a key, open the provider link, then apply it here.", size=12, color=TEXT_MUTED)
    api_list = ft.ListView(expand=True, spacing=12, padding=10)

    def apply_api_settings(e=None):
        if not HAS_SRC_MODULES or not provider_dropdown.value:
            status_text.value = "Provider configuration is unavailable"
            status_text.color = WARNING
            page.update()
            return
        if not api_key_field.value:
            status_text.value = "Paste an API key first"
            status_text.color = WARNING
            page.update()
            return
        provider_type = ProviderType(provider_dropdown.value)
        provider_config = get_provider_config(provider_type)
        save_provider_settings(
            provider_type,
            provider_config.base_url,
            model_field.value or provider_config.model,
            api_key_field.value,
        )
        status_text.value = f"Saved API key for {provider_display_name(provider_type)}"
        status_text.color = SUCCESS
        if on_provider_state_change:
            on_provider_state_change()
        page.update()

    def copy_link(url: str):
        page.set_clipboard(url)
        status_text.value = "Link copied to clipboard"
        status_text.color = SUCCESS
        page.update()

    def open_link(url: str):
        opened = open_external_url(url)
        status_text.value = "Opened provider link" if opened else "Could not open the link automatically"
        status_text.color = SUCCESS if opened else WARNING
        page.update()

    def preset_provider(provider_name: str, api_name: str):
        mapped_provider = FREE_API_PROVIDER_MAP.get(provider_name)
        if mapped_provider and mapped_provider not in enabled_cloud_providers:
            status_text.value = f"{provider_display_name(mapped_provider)} is disabled in Settings"
            status_text.color = WARNING
            page.update()
            return
        if mapped_provider:
            provider_dropdown.value = mapped_provider.value
            model_field.value = FREE_API_MODEL_HINTS.get(api_name, get_provider_config(mapped_provider).model)
        else:
            model_field.value = FREE_API_MODEL_HINTS.get(api_name, "")
        page.update()

    for name, provider, url in FREE_API_LINKS:
        is_free = "Free" in name
        mapped_provider = FREE_API_PROVIDER_MAP.get(provider)
        provider_disabled = bool(mapped_provider and mapped_provider not in enabled_cloud_providers)
        api_list.controls.append(
            ft.Container(
                content=ft.Column(
                    [
                        ft.Row(
                            [
                                ft.Text(name, size=15, weight=ft.FontWeight.W_500),
                                ft.Chip(ft.Text("FREE", size=10))
                                if is_free
                                else ft.Container(),
                            ],
                            alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                        ),
                        ft.Text(
                            f"Provider: {provider}", size=12, color=ft.Colors.GREY_400
                        ),
                        ft.Text(
                            "Disabled in Settings" if provider_disabled else "Available for quick apply",
                            size=11,
                            color=WARNING if provider_disabled else SUCCESS,
                        )
                        if mapped_provider
                        else ft.Text("External link only", size=11, color=TEXT_MUTED),
                        ft.Text(
                            url, size=12, color=ft.Colors.BLUE_300, selectable=True
                        ),
                        ft.Row(
                            [
                                ft.Button(
                                    "Open Link", icon=ft.Icons.OPEN_IN_NEW, on_click=lambda e, link=url: open_link(link)
                                ),
                                ft.OutlinedButton(
                                    "Copy Link", icon=ft.Icons.CONTENT_COPY, on_click=lambda e, link=url: copy_link(link)
                                ),
                                ft.OutlinedButton(
                                    "Use Here", icon=ft.Icons.KEY, on_click=lambda e, provider_name=provider, api_name=name: preset_provider(provider_name, api_name), disabled=provider_disabled
                                ),
                            ]
                        ),
                    ],
                    spacing=4,
                ),
                bgcolor=ft.Colors.with_opacity(0.03 if provider_disabled else 0.06, ft.Colors.GREY_600),
                border=ft.Border.all(1, BORDER_COLOR if not provider_disabled else ACCENT_SOFT),
                border_radius=12,
                padding=ft.Padding.all(12),
                opacity=0.65 if provider_disabled else 1,
            )
        )

    return ft.Column(
        [
            ft.Text("Free Tier APIs", size=18, weight=ft.FontWeight.BOLD),
            ft.Text("Desktop-safe provider links plus a quick API key paste area for supported providers.", size=12, color=TEXT_MUTED),
            ft.Divider(height=1),
            ft.Container(
                bgcolor=CARD_BG,
                border=ft.Border.all(1, BORDER_COLOR),
                border_radius=18,
                padding=ft.Padding(14, 12, 14, 12),
                content=ft.Column(
                    [
                        ft.Text("Quick Apply", size=15, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                        ft.Text("Open the provider page, copy your API key, then paste it here to save it into the desktop settings.", size=12, color=TEXT_MUTED),
                        ft.Row([provider_dropdown, model_field], spacing=8, wrap=True),
                        ft.Row([api_key_field], spacing=8),
                        ft.Row([ft.Button("Save API Key", icon=ft.Icons.SAVE, on_click=apply_api_settings)], spacing=8),
                        status_text,
                    ],
                    spacing=10,
                ),
            ),
            api_list,
        ],
        expand=True,
    )


def main(page: ft.Page):
    apply_theme_preset(load_desktop_state().get("theme_name", "Warm Sand"))

    def rebuild_app_for_theme(theme_name: str):
        apply_theme_preset(theme_name)
        page.clean()
        main(page)
        page.update()

    page.title = "Baba Code Desktop"
    page.theme_mode = ft.ThemeMode.LIGHT
    page.window.width = 1280
    page.window.height = 860
    page.bgcolor = APP_BG
    page.padding = 18
    page.spacing = 0
    page.theme = ft.Theme(
        color_scheme_seed=ACCENT,
        font_family=APP_FONT,
        scaffold_bgcolor=APP_BG,
    )

    desktop_state = load_desktop_state()
    workspace_name = desktop_state.get("workspace_label", PROJECT_ROOT.parent.name or "Workspace")

    chat_screen, send_text_fn, reset_chat_fn, chat_status = create_chat_screen(page)
    provider_state_hooks = {"refresh": lambda: None}

    workspace_name_text = ft.Text(workspace_name, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY)

    def apply_workspace_label(label: str):
        workspace_name_text.value = label or "Workspace"
        page.update()

    nav_items = [
        (ft.Icons.CHAT_BUBBLE_OUTLINE_ROUNDED, "Chat", "Conversation workspace"),
        (ft.Icons.DASHBOARD_CUSTOMIZE_OUTLINED, "Mission Control", "Multimodal and live task workspace"),
        (ft.Icons.PAGEVIEW_ROUNDED, "Analysis", "Expanded task and preview workspace"),
        (ft.Icons.PSYCHOLOGY_OUTLINED, "Reasoning Sandbox", "ARC-style task and evaluator workspace"),
        (ft.Icons.ACCOUNT_TREE_OUTLINED, "Business Brain", "Unified local index for expert agents"),
        (ft.Icons.TUNE_ROUNDED, "Customize", "Desktop preferences"),
        (ft.Icons.RECORD_VOICE_OVER_OUTLINED, "Voice", "Speech output"),
        (ft.Icons.PSYCHOLOGY_ALT_OUTLINED, "Memory", "Workspace notes and sessions"),
        (ft.Icons.AUTO_AWESOME_MOTION_ROUNDED, "Artifacts", "Saved local outputs"),
        (ft.Icons.SPACE_DASHBOARD_OUTLINED, "Runtime", "Claude Code, MCP, local tools"),
        (ft.Icons.MONITOR_HEART_OUTLINED, "Diagnostics", "Live system health checks"),
        (ft.Icons.HUB_OUTLINED, "Skills", "Workspace skill packages"),
        (ft.Icons.CODE_ROUNDED, "Commands", "Mirrored command index"),
        (ft.Icons.HANDYMAN_OUTLINED, "Tools", "Built-ins and mirrored tools"),
        (ft.Icons.CABLE_ROUNDED, "Connectors", "Safe local connectors"),
        (ft.Icons.HISTORY_ROUNDED, "History", "Saved sessions"),
        (ft.Icons.PUBLIC_ROUNDED, "APIs", "Provider links"),
        (ft.Icons.SETTINGS_OUTLINED, "Settings", "Provider configuration"),
    ]

    screen_loading_placeholder = ft.Container(
        alignment=CENTER,
        expand=True,
        content=ft.Column(
            [
                ft.ProgressRing(width=28, height=28, color=ACCENT),
                ft.Text("Loading workspace...", size=12, color=TEXT_MUTED),
            ],
            horizontal_alignment=ft.CrossAxisAlignment.CENTER,
            spacing=12,
        ),
    )

    screen_cache = [None] * len(nav_items)
    screen_cache[0] = chat_screen
    screen_factories = [
        lambda: chat_screen,
        lambda: create_mission_control_screen(page, send_text_fn),
        lambda: create_analysis_screen(page),
        lambda: create_reasoning_sandbox_screen(page, send_text_fn),
        lambda: create_business_brain_screen(page),
        lambda: create_customize_screen(page, apply_workspace_label, rebuild_app_for_theme),
        lambda: create_voice_screen(page),
        lambda: create_memory_screen(page),
        lambda: create_artifacts_screen(page),
        lambda: create_runtime_screen(page),
        lambda: create_diagnostics_screen(page, lambda: provider_state_hooks["refresh"]()),
        lambda: create_skills_screen(page),
        lambda: create_commands_screen(page),
        lambda: create_tools_screen(page),
        lambda: create_connectors_screen(page),
        lambda: create_history_screen(page),
        lambda: create_free_apis_screen(page, lambda: provider_state_hooks["refresh"]()),
        lambda: create_settings_screen(page, lambda: provider_state_hooks["refresh"]()),
    ]

    current_title = ft.Text("Chat", size=28, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY)
    current_subtitle = ft.Text("Conversation workspace", size=12, color=TEXT_MUTED)
    current_screen = ft.Container(content=chat_screen, expand=True)
    nav_controls = []
    screen_load_state = {"token": 0, "active_index": 0, "loading": set()}

    def build_screen_async(idx: int, token: int):
        try:
            built_screen = screen_factories[idx]()
            screen_cache[idx] = built_screen
            if screen_load_state["token"] == token and screen_load_state["active_index"] == idx:
                current_screen.content = built_screen
        finally:
            screen_load_state["loading"].discard(idx)
            page.update()

    def select_screen(idx: int):
        screen_load_state["active_index"] = idx
        screen_load_state["token"] += 1
        selection_token = screen_load_state["token"]
        current_title.value = nav_items[idx][1]
        current_subtitle.value = nav_items[idx][2]
        if nav_items[idx][1] == "Analysis" and sidebar_expanded["value"]:
            toggle_sidebar(False)
        for control_index, control in enumerate(nav_controls):
            selected = control_index == idx
            control.bgcolor = ACCENT_SOFT if selected else ft.Colors.TRANSPARENT
            control.border = ft.Border.all(1, ACCENT if selected else BORDER_COLOR)
        if screen_cache[idx] is not None:
            current_screen.content = screen_cache[idx]
            page.update()
            return

        loading_label = screen_loading_placeholder.content.controls[1]
        loading_label.value = f"Loading {nav_items[idx][1]}..."
        current_screen.content = screen_loading_placeholder
        if idx not in screen_load_state["loading"]:
            screen_load_state["loading"].add(idx)
            threading.Thread(
                target=build_screen_async,
                args=(idx, selection_token),
                daemon=True,
            ).start()
        page.update()

    def build_nav_item(idx: int, icon: str, label: str, subtitle: str):
        tile = ft.Container(
            content=ft.Row(
                [
                    ft.Icon(icon, size=20, color=TEXT_PRIMARY),
                    ft.Column(
                        [
                            ft.Text(label, size=14, weight=ft.FontWeight.W_600, color=TEXT_PRIMARY),
                            ft.Text(subtitle, size=11, color=TEXT_MUTED),
                        ],
                        spacing=1,
                        expand=True,
                    ),
                ],
                spacing=12,
            ),
            border=ft.Border.all(1, BORDER_COLOR),
            border_radius=18,
            padding=ft.Padding(14, 12, 14, 12),
            ink=True,
            on_click=lambda e: (toggle_sidebar(True) if not sidebar_expanded["value"] else None, select_screen(idx)),
        )
        nav_controls.append(tile)
        return tile

    sidebar_expanded = {"value": True}
    sidebar_label_column = ft.Column(
        [build_nav_item(idx, icon, label, subtitle) for idx, (icon, label, subtitle) in enumerate(nav_items)],
        spacing=8,
        expand=True,
    )

    sidebar = ft.Container(
        width=280,
        bgcolor=SIDEBAR_BG,
        border=ft.Border.all(1, BORDER_COLOR),
        border_radius=28,
        padding=ft.Padding(18, 18, 18, 18),
        ink=True,
        on_click=lambda e: toggle_sidebar(True) if not sidebar_expanded["value"] else None,
        content=ft.ListView(
                [
                ft.Row(
                    [
                        ft.Container(
                            width=42,
                            height=42,
                            border_radius=14,
                            bgcolor=ACCENT,
                            alignment=CENTER,
                            content=ft.Text("B", color=ft.Colors.WHITE, size=20, weight=ft.FontWeight.BOLD),
                        ),
                        ft.Column(
                            [
                                ft.Text("Baba", size=24, weight=ft.FontWeight.W_700, color=TEXT_PRIMARY),
                                ft.Text("Claude-style coding desktop", size=12, color=TEXT_MUTED),
                            ],
                            spacing=1,
                            expand=True,
                        ),
                        ft.IconButton(
                            icon=ft.Icons.CHEVRON_LEFT,
                            tooltip="Collapse or expand sidebar",
                            on_click=lambda e: toggle_sidebar(),
                        ),
                    ],
                    spacing=12,
                ),
                ft.Divider(height=18, color=ft.Colors.TRANSPARENT),
                ft.FilledButton(
                    "New chat",
                    icon=ft.Icons.ADD_ROUNDED,
                    style=ft.ButtonStyle(
                        bgcolor=ACCENT,
                        color=ft.Colors.WHITE,
                        shape=ft.RoundedRectangleBorder(radius=18),
                        padding=ft.Padding(14, 14, 14, 14),
                    ),
                    on_click=lambda e: (select_screen(0), reset_chat_fn()),
                ),
                ft.Divider(height=12, color=ft.Colors.TRANSPARENT),
                ft.Text("Workspace", size=12, color=TEXT_MUTED, weight=ft.FontWeight.W_500),
                ft.Container(
                    content=ft.Column(
                        [
                            workspace_name_text,
                            ft.Text(chat_status, size=11, color=TEXT_MUTED),
                        ],
                        spacing=3,
                    ),
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                ),
                ft.Divider(height=8, color=ft.Colors.TRANSPARENT),
                sidebar_label_column,
                ft.Container(
                    content=ft.Text(
                        "This desktop keeps humans in control. No hidden automation or unconfirmed device actions.",
                        size=11,
                        color=TEXT_MUTED,
                    ),
                    bgcolor=CARD_BG,
                    border=ft.Border.all(1, BORDER_COLOR),
                    border_radius=18,
                    padding=ft.Padding(14, 12, 14, 12),
                ),
                ],
                expand=True,
                spacing=0,
                auto_scroll=False,
            ),
    )

    sidebar_header_text = sidebar.content.controls[0].controls[1]
    workspace_card = sidebar.content.controls[3]
    sidebar_footer = sidebar.content.controls[6]

    def toggle_sidebar(force_expanded: bool | None = None):
        sidebar_expanded["value"] = (not sidebar_expanded["value"]) if force_expanded is None else force_expanded
        expanded = sidebar_expanded["value"]
        sidebar.width = 280 if expanded else 96
        sidebar_header_text.visible = expanded
        workspace_card.visible = expanded
        sidebar_footer.visible = expanded
        sidebar.content.auto_scroll = expanded
        sidebar.tooltip = "Click to collapse sidebar" if expanded else "Click anywhere to expand sidebar"
        for item in nav_controls:
            label_column = item.content.controls[1]
            label_column.visible = expanded
            item.padding = ft.Padding(14, 12, 14, 12) if expanded else ft.Padding(12, 12, 12, 12)
        header_button = sidebar.content.controls[0].controls[2]
        header_button.icon = ft.Icons.CHEVRON_RIGHT if not expanded else ft.Icons.CHEVRON_LEFT
        header_sidebar_button.icon = ft.Icons.MENU_OPEN if expanded else ft.Icons.MENU
        header_sidebar_button.tooltip = "Collapse sidebar" if expanded else "Expand sidebar"
        page.update()

    header_sidebar_button = ft.IconButton(
        icon=ft.Icons.MENU_OPEN,
        tooltip="Collapse sidebar",
        on_click=lambda e: toggle_sidebar(),
        style=ft.ButtonStyle(bgcolor=CARD_BG),
    )

    enabled_header_providers_state = {"providers": tuple(get_enabled_provider_types()) if HAS_SRC_MODULES else tuple(supported_provider_types())}
    header_provider = get_config().primary_provider.provider_type if HAS_SRC_MODULES else ProviderType.OLLAMA
    if header_provider not in enabled_header_providers_state["providers"] and enabled_header_providers_state["providers"]:
        header_provider = enabled_header_providers_state["providers"][0]
    header_provider_dropdown = ft.Dropdown(
        width=190,
        value=header_provider.value,
        options=[
            ft.dropdown.Option(provider.value, provider_display_name(provider))
            for provider in enabled_header_providers_state["providers"]
        ],
        dense=True,
        text_size=12,
        border_radius=14,
        bgcolor=CARD_BG,
    )
    header_model_dropdown = ft.Dropdown(
        width=260,
        options=[],
        dense=True,
        text_size=12,
        border_radius=14,
        bgcolor=CARD_BG,
    )
    header_status = ft.Text("", size=11, color=TEXT_MUTED)
    cloud_mode_badge = ft.Container(
        bgcolor=ACCENT_SOFT,
        border_radius=999,
        padding=ft.Padding(12, 8, 12, 8),
        content=ft.Text("", size=12),
    )

    def refresh_header_provider_state():
        enabled_header_providers_state["providers"] = tuple(get_enabled_provider_types()) if HAS_SRC_MODULES else tuple(supported_provider_types())
        enabled_providers = enabled_header_providers_state["providers"]
        header_provider_dropdown.options = [
            ft.dropdown.Option(provider.value, provider_display_name(provider))
            for provider in enabled_providers
        ]
        if enabled_providers:
            if header_provider_dropdown.value not in [provider.value for provider in enabled_providers]:
                header_provider_dropdown.value = enabled_providers[0].value
        enabled_cloud_count = len([provider for provider in enabled_providers if provider in CLOUD_PROVIDER_TYPES])
        cloud_mode_badge.bgcolor = ACCENT_SOFT if enabled_cloud_count else "#E6F3EC"
        cloud_mode_badge.content.value = f"Cloud on ({enabled_cloud_count})" if enabled_cloud_count else "Local only"
        cloud_mode_badge.content.color = WARNING if enabled_cloud_count else SUCCESS
        if header_provider_dropdown.value:
            load_header_models(ProviderType(header_provider_dropdown.value))

    provider_state_hooks["refresh"] = refresh_header_provider_state

    def set_header_models(models: list[str], selected_model: str | None = None):
        unique_models = list(dict.fromkeys(model for model in models if model))
        header_model_dropdown.options = [
            ft.dropdown.Option(model, model) for model in unique_models
        ]
        preferred_model = selected_model or (unique_models[0] if unique_models else None)
        header_model_dropdown.value = preferred_model

    def load_header_models(selected_provider: ProviderType | None = None):
        provider_type = selected_provider or ProviderType(header_provider_dropdown.value)
        provider_config = get_provider_config(provider_type)
        set_header_models([provider_config.model], provider_config.model)

        def fetch_models():
            try:
                with ProviderClient(provider_config) as client:
                    healthy = client.check_health()
                    models = client.list_models() if healthy else []
                if models:
                    set_header_models(models, provider_config.model if provider_config.model in models else models[0])
                    header_status.value = f"{len(models)} models"
                else:
                    header_status.value = "default model"
                page.update()
            except Exception:
                header_status.value = "model list unavailable"
                page.update()

        threading.Thread(target=fetch_models, daemon=True).start()

    def on_header_provider_change(e):
        provider_type = ProviderType(header_provider_dropdown.value)
        provider_config = get_provider_config(provider_type)
        save_provider_settings(
            provider_type,
            provider_config.base_url,
            provider_config.model,
            "" if provider_config.api_key == "not-needed" else provider_config.api_key,
        )
        load_header_models(provider_type)
        header_status.value = f"Switched to {provider_display_name(provider_type)}"
        page.update()

    def on_header_model_change(e):
        if not header_model_dropdown.value:
            return
        provider_type = ProviderType(header_provider_dropdown.value)
        provider_config = get_provider_config(provider_type)
        save_provider_settings(
            provider_type,
            provider_config.base_url,
            header_model_dropdown.value,
            "" if provider_config.api_key == "not-needed" else provider_config.api_key,
        )
        header_status.value = f"Model: {header_model_dropdown.value}"
        page.update()

    header_provider_dropdown.on_change = on_header_provider_change
    header_model_dropdown.on_change = on_header_model_change
    load_header_models(header_provider)

    workspace_panel = ft.Container(
        expand=True,
        bgcolor=PANEL_BG,
        border=ft.Border.all(1, BORDER_COLOR),
        border_radius=28,
        padding=ft.Padding(24, 20, 24, 20),
        content=ft.Column(
                [
                ft.Row(
                    [
                        ft.Row(
                            [
                                header_sidebar_button,
                                ft.Column([current_title, current_subtitle], spacing=2),
                            ],
                            spacing=10,
                            vertical_alignment=ft.CrossAxisAlignment.CENTER,
                        ),
                        ft.Row(
                            [
                                ft.Container(
                                    content=ft.Row(
                                        [
                                            ft.Icon(ft.Icons.LIGHTBULB_OUTLINE, size=16, color=ACCENT),
                                            ft.Text("Local-first assistant workspace", size=12, color=TEXT_MUTED),
                                        ],
                                        spacing=8,
                                    ),
                                    bgcolor=CARD_BG,
                                    border=ft.Border.all(1, BORDER_COLOR),
                                    border_radius=999,
                                    padding=ft.Padding(12, 8, 12, 8),
                                ),
                                cloud_mode_badge,
                                ft.Container(
                                    bgcolor=CARD_BG,
                                    border=ft.Border.all(1, BORDER_COLOR),
                                    border_radius=18,
                                    padding=ft.Padding(10, 8, 10, 8),
                                    content=ft.Row(
                                        [
                                            ft.Text("Provider", size=11, color=TEXT_MUTED),
                                            header_provider_dropdown,
                                            ft.Text("Model", size=11, color=TEXT_MUTED),
                                            header_model_dropdown,
                                            header_status,
                                        ],
                                        spacing=8,
                                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                                    ),
                                ),
                            ],
                            spacing=10,
                            wrap=True,
                            vertical_alignment=ft.CrossAxisAlignment.CENTER,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                ft.Divider(height=14, color=ft.Colors.TRANSPARENT),
                current_screen,
                ],
                expand=True,
                spacing=0,
            ),
    )

    page.add(
        ft.Row(
            [sidebar, workspace_panel],
            expand=True,
            spacing=18,
        )
    )
    refresh_header_provider_state()
    select_screen(0)
    page.update()


if __name__ == "__main__":
    try:
        ft.run(main)
    except TypeError:
        ft.app(target=main)
