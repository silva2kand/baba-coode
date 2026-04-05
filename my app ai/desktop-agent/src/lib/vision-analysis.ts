export type VisionEntities = {
  emails: string[]
  urls: string[]
  phones: string[]
  dates: string[]
}

export type VisionAnalysis = {
  extractedText: string
  summaryLines: string[]
  actionItems: string[]
  entities: VisionEntities
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function sanitizeEntity(value: string) {
  return value.trim().replace(/[),.;:!?]+$/g, '')
}

function isUsefulVisionLine(line: string) {
  const compact = line.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return false
  }

  const alphaNumericCount = (compact.match(/[A-Za-z0-9]/g) ?? []).length
  if (alphaNumericCount === 0) {
    return false
  }

  if (compact.length <= 2 && alphaNumericCount < 2) {
    return false
  }

  const punctuationOnly = compact.replace(/[A-Za-z0-9]/g, '')
  return punctuationOnly.length / compact.length < 0.7
}

function normalizeVisionText(text: string) {
  const normalizedLines: string[] = []

  for (const rawLine of text.replace(/\r/g, '').split('\n')) {
    const line = rawLine
      .replace(/[\u00A0\t]+/g, ' ')
      .replace(/^[|¦]{1,3}\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()

    if (!isUsefulVisionLine(line)) {
      continue
    }

    if (normalizedLines.at(-1)?.toLowerCase() === line.toLowerCase()) {
      continue
    }

    normalizedLines.push(line)
  }

  return normalizedLines.join('\n')
}

function extractMatches(text: string, pattern: RegExp) {
  return unique(Array.from(text.matchAll(pattern), (match) => sanitizeEntity(match[0])))
}

export function analyzeVisionText(text: string): VisionAnalysis {
  const extractedText = normalizeVisionText(text)
  const lines = extractedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const summaryLines = lines.slice(0, 5)
  const actionItems = unique(
    lines.filter((line) => /^(?:[-*•]\s+|\d+\.\s+|\[ ?x? ?\]\s+|todo\b|fix\b|send\b|call\b|email\b|review\b|update\b|submit\b|follow up\b)/i.test(line)),
  ).slice(0, 8)

  return {
    extractedText,
    summaryLines,
    actionItems,
    entities: {
      emails: extractMatches(extractedText, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi),
      urls: extractMatches(extractedText, /https?:\/\/[^\s)]+/gi),
      phones: extractMatches(extractedText, /(?:\+?\d[\d()\-\s]{7,}\d)/g),
      dates: extractMatches(extractedText, /(?:\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?\b)/gi),
    },
  }
}

export function formatVisionPreview(analysis: VisionAnalysis, fallback: string) {
  if (!analysis.extractedText) {
    return fallback
  }

  const sections: string[] = []

  if (analysis.summaryLines.length > 0) {
    sections.push(`OCR summary:\n${analysis.summaryLines.join('\n')}`)
  }

  if (analysis.actionItems.length > 0) {
    sections.push(`Action items:\n${analysis.actionItems.join('\n')}`)
  }

  const entityLines = [
    analysis.entities.emails.length > 0 ? `Emails: ${analysis.entities.emails.join(', ')}` : '',
    analysis.entities.urls.length > 0 ? `URLs: ${analysis.entities.urls.join(', ')}` : '',
    analysis.entities.phones.length > 0 ? `Phones: ${analysis.entities.phones.join(', ')}` : '',
    analysis.entities.dates.length > 0 ? `Dates: ${analysis.entities.dates.join(', ')}` : '',
  ].filter(Boolean)

  if (entityLines.length > 0) {
    sections.push(`Detected entities:\n${entityLines.join('\n')}`)
  }

  sections.push(`Extracted text:\n${analysis.extractedText.slice(0, 12000)}`)
  return sections.join('\n\n')
}