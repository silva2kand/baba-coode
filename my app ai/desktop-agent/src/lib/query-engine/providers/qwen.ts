import { LLMProvider } from './base'

export class QwenProvider extends LLMProvider {
  name = 'Qwen'
  id = 'qwen'
  models = ['qwen3-coder']

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
    yield 'Qwen provider stub response.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Qwen provider stub response.'
  }
}
