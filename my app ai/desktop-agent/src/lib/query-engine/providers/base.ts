export abstract class LLMProvider {
  abstract name: string
  abstract id: string
  connected: boolean = false
  models: string[] = []
  kind: 'local' | 'remote' | 'offline' = 'remote'
  statusDetail = 'Provider scaffold only in this build.'
  configure?(_config: Record<string, unknown>): Promise<void> | void

  abstract isAvailable(): Promise<boolean>
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract listModels(): Promise<string[]>
  abstract stream(messages: any[], options?: any): AsyncGenerator<string, void, unknown>
  abstract complete(messages: any[], options?: any): Promise<string>
}
