import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class HuggingFaceProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'huggingface',
      name: 'Hugging Face',
      baseUrl: 'https://router.huggingface.co/v1',
      defaultModels: ['meta-llama/Meta-Llama-3-8B-Instruct'],
      offlineDetail: 'Hugging Face API is not configured yet.',
      requiresApiKey: true,
    })
    this.kind = 'remote'
  }
}
