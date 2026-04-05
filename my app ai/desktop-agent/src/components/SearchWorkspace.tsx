import { useEffect, useMemo, useState } from 'react'
import { useArtifactStore } from '../store/artifacts'
import type { RuntimeEventInput } from '../store/runtime'
import { useSearchStore } from '../store/search'
import { useSettingsStore } from '../store/settings'
import { toResearchArtifact, type ResearchCommandResult } from '../types/research'

const searchSections = [
  {
    title: 'Live research',
    summary: 'Run a URL or query through the Python research command and persist the result as an artifact.',
  },
  {
    title: 'Artifacts',
    summary: 'Each successful research run is saved and can be reopened in context or sent back to chat.',
  },
  {
    title: 'Guardrails',
    summary: 'Research inherits the same web-fetch privacy and tool toggles already exposed in settings.',
  },
]

type SearchWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onArtifactCreated: (title: string, detail: string) => void
}

export function SearchWorkspace({ onUsePrompt, onRuntimeEvent, onArtifactCreated }: SearchWorkspaceProps) {
  const { models, tools, privacy } = useSettingsStore()
  const { pendingRequest, clearPendingRequest } = useSearchStore()
  const { addResearchArtifact, selectArtifact } = useArtifactStore()
  const [inputText, setInputText] = useState('https://example.com')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ResearchCommandResult | null>(null)

  const denyTools = useMemo(() => {
    const denied: string[] = []
    if (privacy.disableExternalRequests.enabled || privacy.disableWebFetch.enabled || !tools.webFetch.enabled || !tools.webFetch.available || !tools.browserResearch.enabled || !tools.browserResearch.available) {
      denied.push('web.fetch')
    }
    return denied
  }, [privacy.disableExternalRequests.enabled, privacy.disableWebFetch.enabled, tools.browserResearch.available, tools.browserResearch.enabled, tools.webFetch.available, tools.webFetch.enabled])

  const runResearch = async (nextInput?: string) => {
    const trimmed = (nextInput ?? inputText).trim()
    if (!trimmed) {
      setError('Enter a URL or query before running research.')
      return
    }

    setLoading(true)
    setError('')
    onRuntimeEvent({
      kind: 'research',
      status: 'running',
      title: 'Research started',
      detail: trimmed,
      panel: 'search',
      source: 'search-workspace',
      preview: {
        title: 'Research running',
        body: trimmed,
        metadata: [`Model: ${models.reasoningModel}`],
        mode: 'research',
      },
    })

    try {
      const nextResult = await window.electronAPI.runResearch({
        inputText: trimmed,
        model: models.reasoningModel,
        denyTools,
      })
      setResult(nextResult)

      if (!nextResult.ok || !nextResult.synthesis) {
        setError(nextResult.error || 'Research did not return a usable result.')
        onRuntimeEvent({
          kind: 'research',
          status: 'error',
          title: 'Research failed',
          detail: nextResult.error || 'Research did not return a usable result.',
          panel: 'console',
          source: 'search-workspace',
          preview: {
            title: 'Research failed',
            body: nextResult.error || 'Research did not return a usable result.',
            metadata: [trimmed],
            mode: 'research',
          },
        })
        return
      }

      const artifact = toResearchArtifact(nextResult)
      addResearchArtifact(artifact)
      selectArtifact(artifact.id)
      onRuntimeEvent({
        kind: 'research',
        status: 'success',
        title: 'Research completed',
        detail: `${nextResult.artifact_title}\n${nextResult.source.resolved_url}`,
        panel: 'search',
        source: 'search-workspace',
        preview: {
          title: artifact.title,
          body: artifact.summary,
          metadata: [artifact.sourceUrl, `${artifact.keyPoints.length} key points`, `${artifact.risks.length} risks`],
          mode: 'research',
        },
      })
      onArtifactCreated(artifact.title, `Saved research artifact from ${artifact.sourceUrl}.`)
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : 'Research failed.'
      setError(message)
      onRuntimeEvent({
        kind: 'research',
        status: 'error',
        title: 'Research command crashed',
        detail: message,
        panel: 'console',
        source: 'search-workspace',
        preview: {
          title: 'Research failed',
          body: message,
          metadata: [trimmed],
          mode: 'research',
        },
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!pendingRequest) {
      return
    }

    setInputText(pendingRequest.query)
    if (pendingRequest.autoRun) {
      void runResearch(pendingRequest.query)
    }
    clearPendingRequest()
  }, [clearPendingRequest, pendingRequest])

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[28px] border border-claude-border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Search</div>
          <div className="mt-2 text-3xl font-semibold text-claude-text">Research a URL or query and save the result as an artifact</div>
          <div className="mt-5 rounded-3xl border border-claude-border bg-stone-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                className="flex-1 rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm text-claude-text outline-none"
                placeholder="Enter a URL or a query"
              />
              <button
                type="button"
                onClick={() => void runResearch()}
                disabled={loading}
                className="rounded-2xl bg-claude-text px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {loading ? 'Researching...' : 'Run research'}
              </button>
            </div>
            <div className="mt-3 text-xs text-claude-secondary">
              Reasoning model: {models.reasoningModel} · denied tools: {denyTools.length === 0 ? 'none' : denyTools.join(', ')}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {searchSections.map((section) => (
            <div key={section.title} className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
              <div className="text-lg font-semibold text-claude-text">{section.title}</div>
              <div className="mt-2 text-sm text-claude-secondary">{section.summary}</div>
            </div>
          ))}
        </div>

        {error ? (
          <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="mt-5 rounded-3xl border border-claude-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Latest result</div>
              <div className="mt-1 text-sm text-claude-secondary">Loading is shown inline, then the structured research result is rendered here and persisted into artifacts.</div>
            </div>
            {result?.ok && result.synthesis ? (
              <button
                type="button"
                onClick={() => onUsePrompt(result.chat_prompt)}
                className="rounded-full border border-claude-border px-3 py-2 text-xs font-medium text-claude-text"
              >
                Open in chat
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-4 rounded-2xl bg-stone-50 p-5 text-sm text-claude-secondary">Running Python research command, fetching the source, and waiting for model synthesis...</div>
          ) : result?.ok && result.synthesis ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-lg font-semibold text-claude-text">{result.artifact_title}</div>
                <div className="mt-1 text-xs text-claude-secondary">{result.source.resolved_url}</div>
              </div>

              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Summary</div>
                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-claude-text">{result.synthesis.summary}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Key points</div>
                  <div className="mt-2 space-y-2 text-sm text-claude-text">
                    {result.synthesis.key_points.length === 0 ? <div className="text-claude-secondary">None captured.</div> : result.synthesis.key_points.map((item) => <div key={item}>• {item}</div>)}
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Risks</div>
                  <div className="mt-2 space-y-2 text-sm text-claude-text">
                    {result.synthesis.risks.length === 0 ? <div className="text-claude-secondary">None captured.</div> : result.synthesis.risks.map((item) => <div key={item}>• {item}</div>)}
                  </div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Follow-up</div>
                  <div className="mt-2 space-y-2 text-sm text-claude-text">
                    {result.synthesis.follow_up.length === 0 ? <div className="text-claude-secondary">None captured.</div> : result.synthesis.follow_up.map((item) => <div key={item}>• {item}</div>)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-stone-50 p-5 text-sm text-claude-secondary">Run research to see a structured result here.</div>
          )}
        </div>
      </div>
    </section>
  )
}
