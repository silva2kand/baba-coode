import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class GrokProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'grok',
      name: 'Grok',
      baseUrl: 'https://api.x.ai/v1',
      defaultModels: ['grok-3-mini'],
      offlineDetail: 'Grok API is not configured yet.',
      requiresApiKey: true,
    })
    this.kind = 'remote'
  }
}
