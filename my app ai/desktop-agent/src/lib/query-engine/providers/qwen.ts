import { OpenAICompatibleLocalProvider } from './openai-compatible-local'

export class QwenProvider extends OpenAICompatibleLocalProvider {
  constructor() {
    super({
      id: 'qwen',
      name: 'Qwen',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      defaultModels: ['qwen3-coder'],
      offlineDetail: 'Qwen API is not configured yet.',
      requiresApiKey: true,
    })
    this.kind = 'remote'
  }
}
