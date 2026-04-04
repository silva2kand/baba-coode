import { LLMProvider } from './base'

export class HuggingFaceProvider extends LLMProvider {
  name = 'Hugging Face'
  id = 'huggingface'
  models = ['meta-llama/Meta-Llama-3-8B-Instruct']

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
    yield 'Hugging Face provider stub response.'
  }

  async complete(_messages: unknown[], _options: unknown = {}): Promise<string> {
    return 'Hugging Face provider stub response.'
  }
}
