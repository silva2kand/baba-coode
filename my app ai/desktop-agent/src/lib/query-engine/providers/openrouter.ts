import { LLMProvider } from './base'

export class OpenRouterProvider extends LLMProvider {
  name = 'OpenRouter'
  id = 'openrouter'
  models = ['openrouter/auto']

  async isAvailable(): Promise<boolean> {
    return true
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async listModels(): Promise<string[]> {
    return this.models
  }

  async *stream(_messages: unknown[], _options: unknown = {}): AsyncGenerator<string, void, unknown> {
    yield 'OpenRouter provider stub response.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'OpenRouter provider stub response.'
  }
}
