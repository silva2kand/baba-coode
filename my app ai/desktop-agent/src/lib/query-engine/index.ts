import { LLMProvider } from './providers/base'
import { LocalProvider } from './providers/local'
import { OllamaProvider } from './providers/ollama'
import { JanProvider } from './providers/jan'
import { LMStudioProvider } from './providers/lmstudio'
import { GeminiProvider } from './providers/gemini'
import { QwenProvider } from './providers/qwen'
import { GrokProvider } from './providers/grok'
import { OpenRouterProvider } from './providers/openrouter'
import { HuggingFaceProvider } from './providers/huggingface'

export class QueryEngine {
  private providers: Map<string, LLMProvider> = new Map()
  private activeProvider: LLMProvider | null = null

  async init() {
    await this.registerLocalProvider()
    await this.autoDetectProviders()
    this.registerApiProviders()
  }

  private async registerLocalProvider() {
    const local = new LocalProvider()
    await local.connect()
    this.providers.set(local.id, local)
    this.activeProvider = local
  }

  async autoDetectProviders() {
    const detectors = [
      { name: 'ollama', provider: OllamaProvider },
      { name: 'jan', provider: JanProvider },
      { name: 'lmstudio', provider: LMStudioProvider }
    ]

    for (const detector of detectors) {
      try {
        const instance = new detector.provider()
        if (await instance.isAvailable()) {
          await instance.connect()
          this.providers.set(detector.name, instance)
          if (!this.activeProvider) this.activeProvider = instance
        }
      } catch {}
    }
  }

  registerApiProviders() {
    const apiProviders = [
      { name: 'gemini', provider: GeminiProvider },
      { name: 'qwen', provider: QwenProvider },
      { name: 'grok', provider: GrokProvider },
      { name: 'openrouter', provider: OpenRouterProvider },
      { name: 'huggingface', provider: HuggingFaceProvider }
    ]

    for (const api of apiProviders) {
      const instance = new api.provider()
      this.providers.set(api.name, instance)
    }
  }

  async complete(messages: any[], options: any = {}) {
    if (!this.activeProvider) throw new Error('No active LLM provider')

    if (!this.activeProvider.connected) {
      const localProvider = this.providers.get('local')
      if (localProvider) {
        return localProvider.complete(messages, options)
      }
    }

    return this.activeProvider.complete(messages, options)
  }

  async *stream(messages: any[], options: any = {}) {
    if (!this.activeProvider) throw new Error('No active LLM provider')
    yield* this.activeProvider.stream(messages, options)
  }

  getProviders() {
    return Array.from(this.providers.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      available: p.connected,
      models: p.models,
      active: this.activeProvider?.id === id
    }))
  }

  getActiveProvider() {
    return this.activeProvider
      ? {
          id: this.activeProvider.id,
          name: this.activeProvider.name,
          models: this.activeProvider.models,
        }
      : null
  }

  selectProvider(id: string) {
    const provider = this.providers.get(id)
    if (provider && provider.connected) {
      this.activeProvider = provider
      return true
    }
    return false
  }
}

export const queryEngine = new QueryEngine()
