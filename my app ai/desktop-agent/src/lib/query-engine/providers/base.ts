export abstract class LLMProvider {
  abstract name: string
  abstract id: string
  connected: boolean = false
  models: string[] = []

  abstract isAvailable(): Promise<boolean>
  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract listModels(): Promise<string[]>
  abstract stream(messages: any[], options?: any): AsyncGenerator<string, void, unknown>
  abstract complete(messages: any[], options?: any): Promise<string>
}
