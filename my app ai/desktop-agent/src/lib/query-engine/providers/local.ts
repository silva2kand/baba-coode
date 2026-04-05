import { LLMProvider } from './base'

type Message = {
  role: string
  content: string
}

function normalizePrompt(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function extractCommandPayload(input: string): { command: string; payload: string } | null {
  if (!input.startsWith('/')) {
    return null
  }

  const [command, ...rest] = input.slice(1).split(' ')
  return {
    command: command.toLowerCase(),
    payload: rest.join(' ').trim(),
  }
}

function buildPlan(payload: string): string {
  const topic = payload || 'the task in front of you'
  return [
    `Plan for ${topic}:`,
    '',
    '1. Clarify the concrete outcome and constraints.',
    '2. Split the work into the smallest verifiable steps.',
    '3. Execute one step at a time and validate after each change.',
  ].join('\n')
}

function buildSummary(payload: string): string {
  if (!payload) {
    return 'Use /summarize followed by text to condense it into a short summary.'
  }

  const sentences = payload
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)

  const summary = sentences.join(' ')
  return `Summary:\n\n${summary || payload}`
}

function buildRewrite(payload: string): string {
  if (!payload) {
    return 'Use /rewrite followed by text and I will rewrite it in a cleaner, tighter form.'
  }

  const clean = payload
    .replace(/\s+/g, ' ')
    .replace(/\bi\b/g, 'I')
    .trim()

  return `Rewrite:\n\n${clean}`
}

function inferIntent(prompt: string): string {
  const lower = prompt.toLowerCase()

  if (/(bug|error|fix|broken|traceback|exception)/.test(lower)) {
    return 'debugging'
  }

  if (/(build|compile|vite|electron|react|typescript|python)/.test(lower)) {
    return 'implementation'
  }

  if (/(plan|roadmap|steps|approach)/.test(lower)) {
    return 'planning'
  }

  if (/(explain|understand|what is|how does)/.test(lower)) {
    return 'explanation'
  }

  return 'general assistance'
}

function buildGeneralResponse(messages: Message[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const prompt = normalizePrompt(lastUserMessage?.content || '')
  const intent = inferIntent(prompt)

  return [
    'Offline assistant response',
    '',
    `Detected intent: ${intent}.`,
    '',
    'What I can do right now inside this desktop shell:',
    '- Turn rough requests into a concrete plan.',
    '- Summarize or rewrite text.',
    '- Keep a usable local conversation even when no external model is configured.',
    '',
    'Suggested next actions:',
    '1. Use /plan followed by your goal for a concrete action list.',
    '2. Use /summarize followed by text to condense notes.',
    '3. Use /rewrite followed by text to clean up phrasing.',
    '',
    prompt ? `Your latest message was: ${prompt}` : 'Send a message or try one of the quick actions.',
  ].join('\n')
}

function buildResponse(messages: Message[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')
  const prompt = normalizePrompt(lastUserMessage?.content || '')
  const command = extractCommandPayload(prompt)

  if (command) {
    switch (command.command) {
      case 'help':
        return [
          'Local commands:',
          '',
          '- /help',
          '- /plan <goal>',
          '- /summarize <text>',
          '- /rewrite <text>',
          '- /status',
        ].join('\n')
      case 'plan':
        return buildPlan(command.payload)
      case 'summarize':
        return buildSummary(command.payload)
      case 'rewrite':
        return buildRewrite(command.payload)
      case 'status':
        return 'Status:\n\n- Local assistant is active.\n- External providers can be connected from Settings > Models with API key, base URL, and model.'
      default:
        return `Unknown command: /${command.command}\n\nUse /help to see available commands.`
    }
  }

  return buildGeneralResponse(messages)
}

export class LocalProvider extends LLMProvider {
  name = 'Offline Assistant'
  id = 'local'
  models = ['local-guidance']
  kind = 'offline' as const
  statusDetail = 'Always available offline fallback inside the desktop shell.'

  async isAvailable(): Promise<boolean> {
    return true
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

  async *stream(messages: Message[]): AsyncGenerator<string, void, unknown> {
    yield buildResponse(messages)
  }

  async complete(messages: Message[]): Promise<string> {
    return buildResponse(messages)
  }
}
