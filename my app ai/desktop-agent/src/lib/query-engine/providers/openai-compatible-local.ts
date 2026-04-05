import { LLMProvider } from './base'

type OpenAICompatibleLocalConfig = {
  id: string
  name: string
  baseUrl: string
  defaultModels: string[]
  offlineDetail: string
}

type NormalizedMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: unknown
    }
  }>
  error?: {
    message?: string
  }
}

const REQUEST_TIMEOUT_MS = 30_000

function normalizeMessages(messages: unknown[]): NormalizedMessage[] {
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null
      }

      const value = message as { role?: unknown; content?: unknown }
      const role = value.role === 'system' || value.role === 'assistant' ? value.role : 'user'
      const content = typeof value.content === 'string' ? value.content : String(value.content ?? '')

      return {
        role,
        content,
      } satisfies NormalizedMessage
    })
    .filter((message): message is NormalizedMessage => message !== null)
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part
        }

        if (part && typeof part === 'object') {
          const typed = part as { type?: unknown; text?: unknown }
          if (typed.type === 'text' && typeof typed.text === 'string') {
            return typed.text
          }
        }

        return ''
      })
      .join('\n')
      .trim()
  }

  return ''
}

export class OpenAICompatibleLocalProvider extends LLMProvider {
  readonly id: string
  readonly name: string
  readonly baseUrl: string

  constructor(config: OpenAICompatibleLocalConfig) {
    super()
    this.id = config.id
    this.name = config.name
    this.baseUrl = config.baseUrl
    this.models = config.defaultModels
    this.kind = 'local'
    this.statusDetail = config.offlineDetail
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 1200)

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        signal: controller.signal,
      })

      if (!response.ok) {
        return false
      }

      const payload = await response.json().catch(() => null) as { data?: Array<{ id?: string }> } | null
      const models = Array.isArray(payload?.data)
        ? payload.data.map((entry) => entry.id).filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : []

      if (models.length > 0) {
        this.models = models
      }

      return true
    } catch {
      return false
    } finally {
      window.clearTimeout(timer)
    }
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

  async *stream(messages: unknown[], options: unknown = {}): AsyncGenerator<string, void, unknown> {
    const response = await this.complete(messages, options)
    yield response
  }

  async complete(messages: unknown[], options: unknown = {}): Promise<string> {
    if (!this.connected) {
      return `${this.name} is not connected.`
    }

    const normalizedMessages = normalizeMessages(messages)
    if (normalizedMessages.length === 0) {
      return 'No prompt was provided.'
    }

    const optionMap = (options && typeof options === 'object' ? options : {}) as {
      temperature?: number
      maxTokens?: number
      model?: string
    }

    const payload = {
      model: optionMap.model || this.models[0] || 'local-model',
      messages: normalizedMessages,
      temperature: typeof optionMap.temperature === 'number' ? optionMap.temperature : 0.4,
      max_tokens: typeof optionMap.maxTokens === 'number' ? optionMap.maxTokens : 1024,
      stream: false,
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const json = await response.json().catch(() => null) as ChatCompletionsResponse | null
      if (!response.ok) {
        const detail = json?.error?.message || `${response.status} ${response.statusText}`
        throw new Error(`${this.name} request failed: ${detail}`)
      }

      const content = contentToText(json?.choices?.[0]?.message?.content).trim()
      if (!content) {
        throw new Error(`${this.name} returned an empty completion.`)
      }

      return content
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown local provider error.'
      this.statusDetail = message
      throw error
    } finally {
      window.clearTimeout(timer)
    }
  }
}
