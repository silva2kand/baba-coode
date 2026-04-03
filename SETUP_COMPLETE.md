# Baba Code - Setup Complete

## What Was Done

### 1. Replaced "Claude" with "Baba" Branding
- Updated all source code references from "claude" to "baba"
- Changed archive path from `claude_code_ts_snapshot` to `baba_code_ts_snapshot`
- Updated README.md title and branding

### 2. Added Local AI Provider Support

#### Supported Providers:
| Provider | Default URL | Description |
|----------|-------------|-------------|
| **Jan AI** | `localhost:1337` | Full-featured local AI platform (default) |
| **Ollama** | `localhost:11434` | Lightweight, CLI-focused |
| **LM Studio** | `localhost:1234` | Great for model experimentation |

#### Features:
- **Automatic Fallback**: If primary provider is unavailable, seamlessly tries next provider
- **OpenAI-Compatible API**: All providers use the same API format
- **Streaming Support**: Real-time response streaming
- **Configurable**: All settings via environment variables

### 3. New Files Created

#### `src/config.py`
- Configuration management for AI providers
- Environment variable loading
- Provider priority and fallback logic

#### `src/provider.py`
- HTTP client for AI provider communication
- Chat completion API (sync and streaming)
- Provider health checking
- Automatic fallback between providers

#### `.env.example`
- Template configuration file
- All provider settings documented
- Easy to customize

#### `requirements.txt`
- Python dependencies
- httpx for HTTP communication
- python-dotenv for environment loading

### 4. Updated Files

#### `src/query_engine.py`
- Integrated AI provider client
- Real chat completion with local models
- Streaming response support
- Error handling for unavailable providers

#### `src/__init__.py`
- Exported new configuration and provider classes

#### `README.md`
- Updated branding to "Baba Code"
- Added comprehensive setup instructions
- Provider comparison table
- Configuration guide

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Provider
```bash
cp .env.example .env
```

Edit `.env` to select your provider:
```bash
# For Jan AI (default)
BABA_PRIMARY_PROVIDER=jan

# For Ollama
BABA_PRIMARY_PROVIDER=ollama

# For LM Studio
BABA_PRIMARY_PROVIDER=lm_studio
```

### 3. Start Your AI Provider

**Jan AI:**
1. Download from https://jan.ai/
2. Install and start
3. Download a model
4. Runs automatically on `localhost:1337`

**Ollama:**
```bash
ollama run llama3.2
```

**LM Studio:**
1. Download from https://lmstudio.ai/
2. Load a model
3. Start local server

### 4. Run Baba Code
```bash
python -m src.main summary
python -m src.main manifest
python -m src.main commands --limit 10
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BABA_PRIMARY_PROVIDER` | Primary provider (jan/ollama/lm_studio) | `jan` |
| `BABA_MAX_TOKENS` | Maximum tokens per response | `4096` |
| `BABA_TEMPERATURE` | Sampling temperature | `0.7` |
| `BABA_STREAM` | Enable streaming | `true` |
| `BABA_DEBUG` | Debug logging | `false` |

### Provider-Specific URLs

| Provider | Environment Variable | Default |
|----------|---------------------|---------|
| Jan AI | `JAN_BASE_URL` | `http://localhost:1337/v1` |
| Ollama | `OLLAMA_BASE_URL` | `http://localhost:11434/v1` |
| LM Studio | `LM_STUDIO_BASE_URL` | `http://localhost:1234/v1` |

## Testing

All basic commands tested successfully:
- ✅ `python -m src.main summary`
- ✅ `python -m src.main manifest`
- ✅ Provider configuration loading
- ✅ Module imports

## Next Steps

To use Baba Code with full AI capabilities:

1. **Install a local AI provider** (Jan AI recommended for beginners)
2. **Download a model** suitable for your use case
3. **Configure `.env`** with your provider settings
4. **Start interactive chat** (when available)

## Architecture

```
src/
├── config.py          # Configuration management
├── provider.py        # AI provider client
├── query_engine.py    # Query orchestration with AI
├── runtime.py         # Runtime session management
├── commands.py        # Command inventory
├── tools.py           # Tool inventory
└── main.py            # CLI entrypoint
```

## Provider Fallback Flow

```
Primary Provider (e.g., Jan AI)
    ↓ (if unavailable)
Jan AI
    ↓ (if unavailable)
Ollama
    ↓ (if unavailable)
LM Studio
    ↓ (if unavailable)
Error: No providers available
```

## License & Disclaimer

- This project is a Python rewrite focused on local AI provider support
- Not affiliated with or endorsed by Anthropic
- Original Claude Code references are kept for historical context only
