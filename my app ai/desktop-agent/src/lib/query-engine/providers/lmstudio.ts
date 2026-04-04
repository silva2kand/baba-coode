import { LLMProvider } from './base'

export class LMStudioProvider extends LLMProvider {
  name = 'LM Studio'
  id = 'lmstudio'
  models = ['lmstudio-local']

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
    yield 'LM Studio provider is not connected.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'LM Studio provider is not connected.'
  }
}
