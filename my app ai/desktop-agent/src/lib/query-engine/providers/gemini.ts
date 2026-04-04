import { LLMProvider } from './base'

export class GeminiProvider extends LLMProvider {
  name = 'Gemini'
  id = 'gemini'
  models = ['gemini-2.5-flash']

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
    yield 'Gemini provider stub response.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Gemini provider stub response.'
  }
}
