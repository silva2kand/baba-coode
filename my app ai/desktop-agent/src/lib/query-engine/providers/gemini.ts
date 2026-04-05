import { LLMProvider } from './base'

type GeminiConfig = {
  apiKey?: string
  model?: string
}

function normalizeMessages(messages: unknown[]) {
  return messages
    .map((message) => {
      if (!message || typeof message !== 'object') {
        return null
      }
      const value = message as { role?: unknown; content?: unknown }
      const role = value.role === 'system' || value.role === 'assistant' ? value.role : 'user'
      const content = typeof value.content === 'string' ? value.content : String(value.content ?? '')
      return { role, content }
    })
    .filter((item): item is { role: 'system' | 'assistant' | 'user'; content: string } => item !== null)
}

export class GeminiProvider extends LLMProvider {
  name = 'Gemini'
  id = 'gemini'
  models = ['gemini-2.5-flash']
  kind = 'remote' as const
  private apiKey = ''

  configure(config: GeminiConfig) {
    if (typeof config.apiKey === 'string') {
      this.apiKey = config.apiKey.trim()
    }
    if (typeof config.model === 'string' && config.model.trim()) {
      const model = config.model.trim()
      if (!this.models.includes(model)) {
        this.models = [model, ...this.models].slice(0, 10)
      } else {
        this.models = [model, ...this.models.filter((item) => item !== model)]
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.length > 0
  }

  async connect(): Promise<void> {
    if (!this.apiKey) {
      this.connected = false
      this.statusDetail = 'Gemini requires an API key.'
      throw new Error('Gemini requires an API key.')
    }
    this.connected = true
    this.statusDetail = 'Gemini connected.'
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
    if (!this.connected || !this.apiKey) {
      throw new Error('Gemini is not connected.')
    }

    const normalized = normalizeMessages(messages)
    if (normalized.length === 0) {
      return 'No prompt was provided.'
    }

    const optionMap = (options && typeof options === 'object' ? options : {}) as {
      model?: string
      temperature?: number
      maxTokens?: number
    }

    const model = optionMap.model || this.models[0] || 'gemini-2.5-flash'
    const prompt = normalized.map((item) => `${item.role.toUpperCase()}: ${item.content}`).join('\n\n')

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: typeof optionMap.temperature === 'number' ? optionMap.temperature : 0.4,
          maxOutputTokens: typeof optionMap.maxTokens === 'number' ? optionMap.maxTokens : 1024,
        },
      }),
    })

    const data = await response.json().catch(() => null) as {
      error?: { message?: string }
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    } | null

    if (!response.ok) {
      throw new Error(data?.error?.message || `Gemini request failed (${response.status}).`)
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim()
    if (!text) {
      throw new Error('Gemini returned an empty completion.')
    }

    return text
  }
}

