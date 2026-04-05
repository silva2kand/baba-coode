import { describe, expect, it } from 'vitest'
import { analyzeVisionText, formatVisionPreview } from './vision-analysis'

describe('analyzeVisionText', () => {
  it('extracts summary lines, action items, and common entities', () => {
    const sample = [
      'Invoice Review',
      'Send updated quote to client@example.com',
      'Review https://example.com/spec',
      'Call +1 555 123 4567',
      'Meeting on Apr 4, 2026',
      '- Follow up with finance team',
    ].join('\n')

    const result = analyzeVisionText(sample)

    expect(result.summaryLines[0]).toBe('Invoice Review')
    expect(result.actionItems).toContain('Send updated quote to client@example.com')
    expect(result.actionItems).toContain('- Follow up with finance team')
    expect(result.entities.emails).toContain('client@example.com')
    expect(result.entities.urls).toContain('https://example.com/spec')
    expect(result.entities.phones).toContain('+1 555 123 4567')
    expect(result.entities.dates).toContain('Apr 4, 2026')

    const preview = formatVisionPreview(result, 'fallback')
    expect(preview).toContain('Detected entities:')
    expect(preview).toContain('Action items:')
    expect(preview).toContain('Extracted text:')
  })

  it('filters noisy OCR lines, de-duplicates repeats, and trims entity punctuation', () => {
    const sample = [
      '|||',
      'Invoice Review',
      'Invoice Review',
      '   ',
      'Review https://example.com/spec).',
      'Contact finance@example.com;',
      '... ..',
      'Call +1 555 123 4567.',
    ].join('\n')

    const result = analyzeVisionText(sample)

    expect(result.summaryLines).toEqual([
      'Invoice Review',
      'Review https://example.com/spec).',
      'Contact finance@example.com;',
      'Call +1 555 123 4567.',
    ])
    expect(result.entities.urls).toEqual(['https://example.com/spec'])
    expect(result.entities.emails).toEqual(['finance@example.com'])
    expect(result.entities.phones).toEqual(['+1 555 123 4567'])
  })
})