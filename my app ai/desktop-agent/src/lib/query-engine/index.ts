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

  async init(onProvidersChanged?: () => void) {
    await this.registerLocalProvider()
    this.registerApiProviders()
    onProvidersChanged?.()
    void this.autoDetectProviders(onProvidersChanged)
  }

  private async registerLocalProvider() {
    const local = new LocalProvider()
    await local.connect()
    this.providers.set(local.id, local)
    this.activeProvider = local
  }

  async autoDetectProviders(onProvidersChanged?: () => void) {
    const detectors = [
      { name: 'ollama', provider: OllamaProvider },
      { name: 'jan', provider: JanProvider },
      { name: 'lmstudio', provider: LMStudioProvider }
    ]

    const instances = detectors.map(({ provider }) => new provider())
    for (const instance of instances) {
      this.providers.set(instance.id, instance)
    }
    onProvidersChanged?.()

    const electronProbes = typeof window !== 'undefined' && window.electronAPI?.getLocalProviders
      ? await window.electronAPI.getLocalProviders()
      : []
    const probeMap = new Map(electronProbes.map((probe) => [probe.id, probe]))

    for (const instance of instances) {
      try {
        const probe = probeMap.get(instance.id)
        if (probe) {
          instance.models = probe.models.length ? probe.models : instance.models
          instance.statusDetail = probe.detail
          instance.connected = probe.available
          if (probe.available) {
            await instance.connect()
            if (!this.activeProvider || this.activeProvider.id === 'local') {
              this.activeProvider = instance
            }
          }
          onProvidersChanged?.()
          continue
        }

        if (await instance.isAvailable()) {
          await instance.connect()
          instance.statusDetail = `${instance.name} detected locally.`
          if (!this.activeProvider || this.activeProvider.id === 'local') this.activeProvider = instance
        } else {
          instance.statusDetail = `${instance.name} was not detected on this machine.`
        }
      } catch {
        instance.connected = false
        instance.statusDetail = `${instance.name} probe failed during detection.`
      }
      onProvidersChanged?.()
    }
  }

  async reprobeProviders(onProvidersChanged?: () => void) {
    await this.autoDetectProviders(onProvidersChanged)
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
      instance.statusDetail = `${instance.name} is scaffolded, but API connection is not configured in this build yet.`
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

    try {
      return await this.activeProvider.complete(messages, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Provider request failed.'
      this.activeProvider.connected = false
      this.activeProvider.statusDetail = `${this.activeProvider.name} request failed. Falling back to offline assistant. (${message})`

      const localProvider = this.providers.get('local')
      if (localProvider && localProvider.id !== this.activeProvider.id) {
        this.activeProvider = localProvider
        return localProvider.complete(messages, options)
      }

      throw error
    }
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
      active: this.activeProvider?.id === id,
      kind: p.kind,
      status: (this.activeProvider?.id === id ? 'active' : p.connected ? 'ready' : 'offline') as 'active' | 'ready' | 'offline',
      detail: p.statusDetail,
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
