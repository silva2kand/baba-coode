import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class OllamaProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'ollama',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      defaultModels: ['llama3.2'],
      offlineDetail: 'Checking local Ollama service.',
    })
  }
}
