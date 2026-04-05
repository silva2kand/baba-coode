import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class LMStudioProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'lmstudio',
      name: 'LM Studio',
      baseUrl: 'http://localhost:1234/v1',
      defaultModels: ['lmstudio-local'],
      offlineDetail: 'Checking local LM Studio service.',
    })
  }
}
