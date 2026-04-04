import { LLMProvider } from './base'

export class GrokProvider extends LLMProvider {
  name = 'Grok'
  id = 'grok'
  models = ['grok-3-mini']

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
    yield 'Grok provider stub response.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Grok provider stub response.'
  }
}
