import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class JanProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'jan',
      name: 'Jan',
      baseUrl: 'http://localhost:1337/v1',
      defaultModels: ['jan-local'],
      offlineDetail: 'Checking local Jan service.',
    })
  }
}
