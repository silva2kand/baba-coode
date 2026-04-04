import { LLMProvider } from './base'

export class OllamaProvider extends LLMProvider {
  name = 'Ollama'
  id = 'ollama'
  models = ['llama3.2']

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
    yield 'Ollama provider is not connected.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Ollama provider is not connected.'
  }
}
