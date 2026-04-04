import { LLMProvider } from './base'

export class JanProvider extends LLMProvider {
  name = 'Jan'
  id = 'jan'
  models = ['jan-local']

  async isAvailable(): Promise<boolean> {
    return false
  }

  async connect(): Promise<void> {
    this.connected = false
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async listModels(): Promise<string[]> {
    return this.models
  }

  async *stream(_messages: unknown[], _options: unknown = {}): AsyncGenerator<string, void, unknown> {
    yield 'Jan provider is not connected.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Jan provider is not connected.'
  }
}
