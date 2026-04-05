export type WhatsAppMessage = {
  timestamp: string
  sender: string
  text: string
}

export type WhatsAppParseResult = {
  totalMessages: number
  participants: Array<{ name: string; count: number }>
  sample: WhatsAppMessage[]
  actionItems: string[]
}

const messagePatterns = [
  /^(\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\s-\s([^:]+):\s([\s\S]+)$/u,
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4},\s\d{1,2}:\d{2}(?::\d{2})?\s?(?:AM|PM|am|pm)?)\]\s([^:]+):\s([\s\S]+)$/u,
]

function isActionItem(text: string) {
  return /\b(todo|to do|action|deadline|follow up|follow-up|urgent|asap|please do|need to)\b/i.test(text)
}

export function parseWhatsAppExport(content: string): WhatsAppParseResult {
  const lines = content.split(/\r?\n/)
  const messages: WhatsAppMessage[] = []
  let current: WhatsAppMessage | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line) {
      continue
    }

    let matched: RegExpMatchArray | null = null
    for (const pattern of messagePatterns) {
      const attempt = line.match(pattern)
      if (attempt) {
        matched = attempt
        break
      }
    }

    if (matched) {
      current = {
        timestamp: matched[1].trim(),
        sender: matched[2].trim(),
        text: matched[3].trim(),
      }
      messages.push(current)
    } else if (current) {
      current.text = `${current.text}\n${line}`
    }
  }

  if (messages.length === 0) {
    throw new Error('No WhatsApp messages were detected. Ensure this is a standard exported chat text file.')
  }

  const counts = new Map<string, number>()
  for (const message of messages) {
    counts.set(message.sender, (counts.get(message.sender) || 0) + 1)
  }

  const participants = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count)

  const actionItems = messages
    .filter((message) => isActionItem(message.text))
    .slice(0, 25)
    .map((message) => `${message.sender}: ${message.text}`)

  return {
    totalMessages: messages.length,
    participants,
    sample: messages.slice(-20),
    actionItems,
  }
}

