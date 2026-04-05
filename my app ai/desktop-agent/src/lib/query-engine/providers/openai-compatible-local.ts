import { LLMProvider } from './base'

type OpenAICompatibleProviderConfig = {
  id: string
  name: string
  baseUrl: string
  defaultModels: string[]
  offlineDetail: string
  requiresApiKey?: boolean
  staticHeaders?: Record<string, string>
}

type OpenAICompatibleConfigUpdate = {
  apiKey?: string
  baseUrl?: string
  model?: string
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

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

export class OpenAICompatibleLocalProvider extends LLMProvider {
  readonly id: string
  readonly name: string
  readonly requiresApiKey: boolean
  readonly staticHeaders: Record<string, string>
  baseUrl: string
  apiKey = ''

  constructor(config: OpenAICompatibleProviderConfig) {
    super()
    this.id = config.id
    this.name = config.name
    this.baseUrl = normalizeBaseUrl(config.baseUrl)
    this.models = config.defaultModels
    this.kind = 'local'
    this.statusDetail = config.offlineDetail
    this.requiresApiKey = config.requiresApiKey ?? false
    this.staticHeaders = config.staticHeaders ?? {}
  }

  configure(config: OpenAICompatibleConfigUpdate) {
    if (typeof config.baseUrl === 'string' && config.baseUrl.trim()) {
      this.baseUrl = normalizeBaseUrl(config.baseUrl.trim())
    }
    if (typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim()
    }
    if (typeof config.model === 'string' && config.model.trim()) {
      const model = config.model.trim()
      if (!this.models.includes(model)) {
        this.models = [model, ...this.models].slice(0, 20)
      } else {
        this.models = [model, ...this.models.filter((item) => item !== model)]
      }
    }
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.staticHeaders,
    }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`
    }
    return headers
  }

  async isAvailable(): Promise<boolean> {
    if (this.requiresApiKey && !this.apiKey) {
      return false
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 1500)

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        signal: controller.signal,
        headers: this.buildHeaders(),
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
    if (this.requiresApiKey && !this.apiKey) {
      this.connected = false
      this.statusDetail = `${this.name} requires an API key.`
      throw new Error(`${this.name} requires an API key.`)
    }

    const available = await this.isAvailable()
    this.connected = available
    this.statusDetail = available
      ? `${this.name} connected.`
      : `${this.name} could not be reached at ${this.baseUrl}.`
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
      throw new Error(`${this.name} is not connected.`)
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
      model: optionMap.model || this.models[0] || 'model',
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
        headers: this.buildHeaders(),
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
      const message = error instanceof Error ? error.message : 'Unknown provider error.'
      this.statusDetail = message
      throw error
    } finally {
      window.clearTimeout(timer)
    }
  }
}

