import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class OpenRouterProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'openrouter',
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      defaultModels: ['openrouter/auto'],
      offlineDetail: 'OpenRouter API is not configured yet.',
      requiresApiKey: true,
      staticHeaders: {
        'HTTP-Referer': 'https://localhost',
        'X-Title': 'SILVA Command Center',
      },
    })
    this.kind = 'remote'
  }
}
