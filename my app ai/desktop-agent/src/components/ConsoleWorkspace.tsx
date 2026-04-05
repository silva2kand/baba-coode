import { useEffect, useMemo, useState } from 'react'
import { useRuntimeStore } from '../store/runtime'
import type { PreviewFocusMode, WorkspacePanel } from '../types/workspace'

type ConsoleWorkspaceProps = {
  onNavigate: (panel: WorkspacePanel) => void
  onUsePrompt: (prompt: string) => void
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
  embedded?: boolean
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}

function statusClass(status: 'info' | 'running' | 'success' | 'error') {
  if (status === 'success') {
    return 'bg-emerald-50 text-emerald-700'
  }
  if (status === 'error') {
    return 'bg-rose-50 text-rose-700'
  }
  if (status === 'running') {
    return 'bg-amber-50 text-amber-700'
  }
  return 'bg-sky-50 text-sky-700'
}

export function ConsoleWorkspace({ onNavigate, onUsePrompt, onPreviewFocus, embedded = false }: ConsoleWorkspaceProps) {
  const { events, clearEvents } = useRuntimeStore()
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? events[0] ?? null,
    [events, selectedEventId],
  )

  useEffect(() => {
    if (!selectedEvent) {
      onPreviewFocus(null)
      return
    }

    onPreviewFocus({
      title: selectedEvent.title,
      body: selectedEvent.detail,
      metadata: [selectedEvent.kind, selectedEvent.status, selectedEvent.panel],
      mode: 'runtime',
    })
  }, [onPreviewFocus, selectedEvent])

  return (
    <section className={`h-full overflow-auto ${embedded ? 'bg-white p-4' : 'bg-[#f7f2e8] p-6'}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {!embedded ? (
          <div className="rounded-[28px] border border-claude-border bg-[#1f2430] p-6 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Console surface</div>
            <div className="mt-2 text-3xl font-semibold">CLI-style runtime inside the main Baba window</div>
            <div className="mt-2 max-w-3xl text-sm text-white/70">
              Command routing, tool traces, research runs, artifact creation, and surface switches land here so the desktop behaves like one unified shell instead of separate windows.
            </div>
          </div>
        ) : null}

        <div className={`grid gap-5 ${embedded ? 'xl:grid-cols-1' : 'xl:grid-cols-[0.9fr_1.1fr]'}`}>
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Runtime log</div>
                <div className="mt-1 text-sm text-claude-secondary">Recent actions that drove the workspace router and in-window command surfaces.</div>
              </div>
              {!embedded ? (
                <button
                  type="button"
                  onClick={() => {
                    clearEvents()
                    onPreviewFocus(null)
                  }}
                  disabled={events.length === 0}
                  className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                >
                  Clear log
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  No runtime events yet. Use the command bar, run research, inspect files, or save an artifact to populate the in-window console.
                </div>
              ) : (
                events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => {
                      setSelectedEventId(event.id)
                      onPreviewFocus({
                        title: event.title,
                        body: event.detail,
                        metadata: [event.kind, event.status, event.panel],
                        mode: 'runtime',
                      })
                    }}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedEvent?.id === event.id ? 'border-claude-text bg-stone-50' : 'border-claude-border bg-white hover:bg-stone-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-claude-text">{event.title}</div>
                        <div className="mt-1 text-xs text-claude-secondary">{event.kind} · {formatTimestamp(event.createdAt)} · {event.source}</div>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusClass(event.status)}`}>
                        {event.status}
                      </div>
                    </div>
                    <div className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-claude-secondary">{event.detail}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          {!embedded ? (
            <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Inspector</div>
                <div className="mt-1 text-sm text-claude-secondary">Inspect the selected runtime event and reopen the related surface or push it back into chat.</div>
              </div>
              {selectedEvent ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(selectedEvent.panel)}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                  >
                    Open {selectedEvent.panel}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Use this runtime event as context:\n\n${selectedEvent.title}\n${selectedEvent.detail}`)}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                  >
                    Send to chat
                  </button>
                </div>
              ) : null}
            </div>

            {selectedEvent ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-claude-text">{selectedEvent.title}</div>
                  <div className="mt-1 text-xs text-claude-secondary">{selectedEvent.kind} · {selectedEvent.status} · target surface: {selectedEvent.panel}</div>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Event detail</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedEvent.detail}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                Select a runtime event to inspect it here.
              </div>
            )}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}