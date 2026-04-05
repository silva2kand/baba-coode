import { useEffect, useMemo } from 'react'
import { useArtifactStore } from '../store/artifacts'
import { useRuntimeStore } from '../store/runtime'
import type { PreviewFocusMode } from '../types/workspace'

type CodingWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}

export function CodingWorkspace({ onUsePrompt, onPreviewFocus }: CodingWorkspaceProps) {
  const { artifacts } = useArtifactStore()
  const { events } = useRuntimeStore()

  const codingEvents = useMemo(
    () => events.filter((event) => event.panel === 'coding').slice(0, 6),
    [events],
  )

  const codingArtifacts = useMemo(
    () => artifacts.filter((artifact) => artifact.kind === 'file' || artifact.kind === 'chat').slice(0, 5),
    [artifacts],
  )

  useEffect(() => {
    const latestCodingEvent = codingEvents[0]
    if (latestCodingEvent) {
      onPreviewFocus({
        title: latestCodingEvent.title,
        body: latestCodingEvent.detail,
        metadata: [formatTimestamp(latestCodingEvent.createdAt), latestCodingEvent.source],
        mode: 'runtime',
      })
      return
    }

    const latestCodingArtifact = codingArtifacts[0]
    if (latestCodingArtifact) {
      onPreviewFocus({
        title: latestCodingArtifact.title,
        body: latestCodingArtifact.kind === 'file' ? latestCodingArtifact.content : latestCodingArtifact.content,
        metadata: [latestCodingArtifact.kind === 'file' ? latestCodingArtifact.path : `${latestCodingArtifact.role} message`],
        mode: latestCodingArtifact.kind === 'file' ? 'file' : 'message',
      })
      return
    }

    onPreviewFocus({
      title: 'Coding surface ready',
      body: 'Send a code-oriented prompt, inspect a file, or save a message artifact to establish active coding context.',
      metadata: ['Waiting for coding context'],
      mode: 'route',
    })
  }, [codingArtifacts, codingEvents, onPreviewFocus])

  return (
    <section className="h-full overflow-auto bg-[#f4efe3] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-[28px] border border-claude-border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Coding surface</div>
          <div className="mt-2 text-3xl font-semibold text-claude-text">Code-focused mode inside the main window</div>
          <div className="mt-2 max-w-3xl text-sm text-claude-secondary">
            Baba now routes code-heavy prompts here automatically, so implementation work can sit beside runtime logs, file artifacts, and the main conversation without spawning a separate CLI window.
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Recent coding intents</div>
            <div className="mt-4 space-y-3">
              {codingEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  Send a code-oriented prompt from chat or the command bar to let the router open this surface automatically.
                </div>
              ) : (
                codingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onPreviewFocus({
                      title: event.title,
                      body: event.detail,
                      metadata: [formatTimestamp(event.createdAt), event.source],
                      mode: 'runtime',
                    })}
                    className="w-full rounded-2xl border border-claude-border bg-stone-50 p-4 text-left transition hover:bg-white"
                  >
                    <div className="text-sm font-semibold text-claude-text">{event.title}</div>
                    <div className="mt-1 text-xs text-claude-secondary">{formatTimestamp(event.createdAt)} · {event.source}</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm text-claude-secondary">{event.detail}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Working context</div>
            <div className="mt-4 space-y-3">
              {codingArtifacts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  Save a file preview or a chat message as an artifact to keep coding context attached to this mode.
                </div>
              ) : (
                codingArtifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    onClick={() => {
                      onPreviewFocus({
                        title: artifact.title,
                        body: artifact.kind === 'file' ? artifact.content : artifact.content,
                        metadata: [artifact.kind === 'file' ? artifact.path : `${artifact.role} message`],
                        mode: artifact.kind === 'file' ? 'file' : 'message',
                      })
                      onUsePrompt(artifact.chatPrompt)
                    }}
                    className="w-full rounded-2xl border border-claude-border bg-stone-50 p-4 text-left transition hover:bg-white"
                  >
                    <div className="text-sm font-semibold text-claude-text">{artifact.title}</div>
                    <div className="mt-1 text-xs text-claude-secondary">{artifact.kind === 'file' ? artifact.path : `${artifact.role} message`}</div>
                    <div className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-claude-secondary">{artifact.kind === 'file' ? artifact.content : artifact.content}</div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}