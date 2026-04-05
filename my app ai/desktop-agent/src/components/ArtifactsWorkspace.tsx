import { useEffect, useMemo } from 'react'
import { VisionDetailCard } from './VisionDetailCard'
import { useArtifactStore } from '../store/artifacts'
import type { ArtifactRecord } from '../types/research'
import type { PreviewFocusMode } from '../types/workspace'

type ArtifactsWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}

function artifactSubtitle(artifact: ArtifactRecord) {
  if (artifact.kind === 'research') {
    return `${artifact.sourceKind === 'query' ? 'Query research' : 'URL research'} · ${formatTimestamp(artifact.createdAt)}`
  }
  if (artifact.kind === 'file') {
    return `File artifact · ${formatTimestamp(artifact.createdAt)}`
  }
  if (artifact.kind === 'web') {
    return `Web artifact · ${formatTimestamp(artifact.createdAt)}`
  }
  if (artifact.kind === 'media') {
    return `${artifact.sourceType === 'image' ? 'Image artifact' : 'Document artifact'} · ${formatTimestamp(artifact.createdAt)}`
  }
  return `Chat artifact · ${formatTimestamp(artifact.messageCreatedAt)}`
}

function artifactSummary(artifact: ArtifactRecord) {
  if (artifact.kind === 'research') {
    return artifact.summary
  }
  if (artifact.kind === 'file') {
    return artifact.content.slice(0, 240)
  }
  if (artifact.kind === 'web') {
    return artifact.preview
  }
  if (artifact.kind === 'media') {
    return artifact.previewText
  }
  return artifact.content
}

function artifactPreviewMode(artifact: ArtifactRecord): PreviewFocusMode {
  if (artifact.kind === 'research') {
    return 'research'
  }
  if (artifact.kind === 'file') {
    return 'file'
  }
  if (artifact.kind === 'web') {
    return 'web'
  }
  if (artifact.kind === 'media') {
    return 'media'
  }
  return 'message'
}

function artifactPreviewBody(artifact: ArtifactRecord) {
  if (artifact.kind === 'research') {
    return artifact.summary
  }
  if (artifact.kind === 'file') {
    return artifact.content
  }
  if (artifact.kind === 'web') {
    return artifact.preview
  }
  if (artifact.kind === 'media') {
    return artifact.previewText || artifact.extractedText
  }
  return artifact.content
}

function artifactPreviewMetadata(artifact: ArtifactRecord) {
  if (artifact.kind === 'research') {
    return [artifact.sourceUrl, `${artifact.keyPoints.length} key points`, `${artifact.risks.length} risks`]
  }
  if (artifact.kind === 'file') {
    return [artifact.path, `${artifact.size.toLocaleString()} bytes${artifact.truncated ? ' · truncated' : ''}`]
  }
  if (artifact.kind === 'web') {
    return [artifact.url, `Status ${artifact.status}`, artifact.contentType || 'unknown content']
  }
  if (artifact.kind === 'media') {
    return [artifact.mimeType || 'unknown', `${artifact.size.toLocaleString()} bytes`, artifact.sourceType]
  }
  return [`${artifact.role} message`, formatTimestamp(artifact.messageCreatedAt)]
}

export function ArtifactsWorkspace({ onUsePrompt, onPreviewFocus }: ArtifactsWorkspaceProps) {
  const { artifacts, selectedArtifactId, selectArtifact, clearArtifacts } = useArtifactStore()

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  )

  useEffect(() => {
    if (!selectedArtifact) {
      onPreviewFocus(null)
      return
    }

    onPreviewFocus({
      title: selectedArtifact.title,
      body: artifactPreviewBody(selectedArtifact),
      metadata: artifactPreviewMetadata(selectedArtifact),
      mode: artifactPreviewMode(selectedArtifact),
    })
  }, [onPreviewFocus, selectedArtifact])

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-[28px] border border-claude-border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Artifacts</div>
              <div className="mt-2 text-3xl font-semibold text-claude-text">Research artifacts and reusable working context</div>
              <div className="mt-2 max-w-3xl text-sm text-claude-secondary">
                Research runs, tool outputs, saved media, and captured chat messages persist here so they can be reopened in the right context panel and pushed back into chat as working context.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearArtifacts()
                onPreviewFocus(null)
              }}
              disabled={artifacts.length === 0}
              className="rounded-full border border-claude-border px-3 py-2 text-xs font-medium text-claude-text disabled:opacity-50"
            >
              Clear artifacts
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Saved artifacts</div>
            <div className="mt-4 space-y-3">
              {artifacts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  No artifacts yet. Save a research result, file preview, web fetch, local media item, or chat message to persist the first artifact.
                </div>
              ) : (
                artifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    onClick={() => selectArtifact(artifact.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedArtifact?.id === artifact.id ? 'border-claude-text bg-stone-50' : 'border-claude-border bg-white hover:bg-stone-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-claude-text">{artifact.title}</div>
                        <div className="mt-1 text-xs text-claude-secondary">{artifactSubtitle(artifact)}</div>
                      </div>
                      <div className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                        {artifact.kind}
                      </div>
                    </div>
                    <div className="mt-3 line-clamp-3 text-sm text-claude-secondary">{artifactSummary(artifact)}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Artifact detail</div>
                <div className="mt-1 text-sm text-claude-secondary">Open one artifact to inspect the research result and send it back into chat.</div>
              </div>
              {selectedArtifact ? (
                <button
                  type="button"
                  onClick={() => onUsePrompt(selectedArtifact.chatPrompt)}
                  className="rounded-full border border-claude-border px-3 py-2 text-xs font-medium text-claude-text"
                >
                  Open in chat
                </button>
              ) : null}
            </div>

            {selectedArtifact ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-claude-text">{selectedArtifact.title}</div>
                  <div className="mt-1 text-xs text-claude-secondary">
                    {selectedArtifact.kind === 'research'
                      ? selectedArtifact.sourceUrl
                      : selectedArtifact.kind === 'file'
                        ? selectedArtifact.path
                        : selectedArtifact.kind === 'web'
                          ? selectedArtifact.url
                          : selectedArtifact.kind === 'media'
                            ? selectedArtifact.mimeType || selectedArtifact.name
                            : `${selectedArtifact.role} · ${formatTimestamp(selectedArtifact.messageCreatedAt)}`}
                  </div>
                </div>
                {selectedArtifact.kind === 'research' ? (
                  <>
                    <div className="rounded-2xl bg-stone-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Summary</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedArtifact.summary}</div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Key points</div>
                        <div className="mt-2 space-y-2 text-sm text-claude-text">
                          {selectedArtifact.keyPoints.length === 0 ? <div className="text-claude-secondary">None captured.</div> : selectedArtifact.keyPoints.map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Risks</div>
                        <div className="mt-2 space-y-2 text-sm text-claude-text">
                          {selectedArtifact.risks.length === 0 ? <div className="text-claude-secondary">None captured.</div> : selectedArtifact.risks.map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-stone-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Follow-up</div>
                        <div className="mt-2 space-y-2 text-sm text-claude-text">
                          {selectedArtifact.followUp.length === 0 ? <div className="text-claude-secondary">None captured.</div> : selectedArtifact.followUp.map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-claude-border bg-white p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Source preview</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedArtifact.preview || 'No source preview available.'}</div>
                    </div>
                  </>
                ) : selectedArtifact.kind === 'file' ? (
                  <div className="rounded-2xl border border-claude-border bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">File preview</div>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedArtifact.size.toLocaleString()} bytes {selectedArtifact.truncated ? '· preview truncated' : ''}</div>
                    <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-xs text-claude-text">{selectedArtifact.content}</pre>
                  </div>
                ) : selectedArtifact.kind === 'web' ? (
                  <div className="rounded-2xl border border-claude-border bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Web preview</div>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedArtifact.status} · {selectedArtifact.contentType}</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedArtifact.preview || 'No preview available.'}</div>
                  </div>
                ) : selectedArtifact.kind === 'media' ? (
                  <div className="rounded-2xl border border-claude-border bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Media preview</div>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedArtifact.mimeType || 'unknown'} · {selectedArtifact.size.toLocaleString()} bytes {selectedArtifact.truncated ? '· preview truncated' : ''}</div>
                    {selectedArtifact.previewDataUrl ? (
                      <img src={selectedArtifact.previewDataUrl} alt={selectedArtifact.name} className="mt-3 max-h-[28rem] w-full rounded-2xl object-contain" />
                    ) : null}
                    <div className="mt-3">
                      <VisionDetailCard
                        summaryLines={selectedArtifact.summaryLines}
                        actionItems={selectedArtifact.actionItems}
                        entities={selectedArtifact.entities}
                        extractedText={selectedArtifact.extractedText}
                        onUsePrompt={onUsePrompt}
                        memoryTitle={selectedArtifact.title}
                        memorySourceLabel="saved vision artifact"
                      />
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedArtifact.previewText || 'No preview available.'}</div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-claude-border bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Saved message</div>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedArtifact.role} · {formatTimestamp(selectedArtifact.messageCreatedAt)}</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedArtifact.content}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                Select a saved artifact to inspect it here and in the right context panel.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}