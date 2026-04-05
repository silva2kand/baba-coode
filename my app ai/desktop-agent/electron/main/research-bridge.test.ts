import { describe, expect, it } from 'vitest'
import { runResearch } from './research-bridge'

describe('runResearch bridge', () => {
  it('returns structured JSON when web.fetch is denied', async () => {
    const result = await runResearch({
      inputText: 'https://example.com',
      denyTools: ['web.fetch'],
    })

    expect(result.ok).toBe(false)
    expect(result.artifact_kind).toBe('research')
    expect(result.source?.resolved_url).toBe('https://example.com')
    expect(Array.isArray(result.permission_denials)).toBe(true)
    expect(result.permission_denials[0]?.tool_name).toBe('web.fetch')
    expect(typeof result.error).toBe('string')
    expect(result.error.toLowerCase()).toContain('permission')
  }, 30000)
})