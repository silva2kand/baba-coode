import { useEffect, useMemo, useState } from 'react'
import { useArtifactStore } from '../store/artifacts'
import { useChatStore } from '../store/chat'
import { useMemoryStore } from '../store/memory'
import { useRuntimeStore } from '../store/runtime'
import type { PreviewFocusMode } from '../types/workspace'

type MemoryWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}

export function MemoryWorkspace({ onUsePrompt, onPreviewFocus }: MemoryWorkspaceProps) {
  const { artifacts } = useArtifactStore()
  const { messages } = useChatStore()
  const { events } = useRuntimeStore()
  const { entries, selectedEntryId, addEntry, addNote, selectEntry, deleteEntry, clearEntries } = useMemoryStore()
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  const recentArtifacts = useMemo(() => artifacts.slice(0, 5), [artifacts])
  const recentMessages = useMemo(() => messages.slice(-5).reverse(), [messages])
  const recentEvents = useMemo(() => events.slice(0, 6), [events])
  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0] ?? null,
    [entries, selectedEntryId],
  )

  useEffect(() => {
    if (selectedEntry) {
      onPreviewFocus({
        title: selectedEntry.title,
        body: selectedEntry.content,
        metadata: [selectedEntry.sourceLabel, formatTimestamp(selectedEntry.updatedAt)],
        mode: 'message',
      })
      return
    }

    onPreviewFocus({
      title: 'Memory surface ready',
      body: 'Saved notes, captured artifacts, recent chat context, and runtime traces will appear here as reusable working memory.',
      metadata: [`${entries.length} saved entries`, `${recentMessages.length} recent messages`, `${recentEvents.length} runtime traces`],
      mode: 'route',
    })
  }, [entries.length, onPreviewFocus, recentEvents.length, recentMessages.length, selectedEntry])

  const saveNote = () => {
    const trimmedContent = noteContent.trim()
    if (!trimmedContent) {
      return
    }

    addNote(noteTitle, trimmedContent)
    setNoteTitle('')
    setNoteContent('')
  }

  const captureLatestArtifact = () => {
    const artifact = recentArtifacts[0]
    if (!artifact) {
      return
    }

    addEntry({
      kind: 'artifact',
      title: artifact.title,
      sourceLabel: `artifact · ${artifact.kind}`,
      content: artifact.chatPrompt,
    })
  }

  const captureLatestMessage = () => {
    const message = recentMessages[0]
    if (!message) {
      return
    }

    addEntry({
      kind: 'message',
      title: `${message.role} message`,
      sourceLabel: `chat · ${message.role}`,
      content: message.content,
    })
  }

  const captureLatestRuntime = () => {
    const event = recentEvents[0]
    if (!event) {
      return
    }

    addEntry({
      kind: 'runtime',
      title: event.title,
      sourceLabel: `runtime · ${event.kind}`,
      content: event.detail,
    })
  }

  return (
    <section className="h-full overflow-auto bg-[#f5f0e6] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-[28px] border border-claude-border bg-white p-6 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Memory surface</div>
          <div className="mt-2 text-3xl font-semibold text-claude-text">Working memory, saved context, and persistent notes</div>
          <div className="mt-2 max-w-3xl text-sm text-claude-secondary">
            This surface now keeps reusable context across sessions: saved notes, captured artifacts, recent runtime actions, and conversation history. It is the in-window memory deck Baba can reopen when the task needs prior context instead of a fresh chat.
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Saved memory entries</div>
                <div className="mt-1 text-sm text-claude-secondary">Persistent memory notes and captured context that survive across sessions in the desktop app.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onUsePrompt('Summarize the saved memory entries into a concise working-memory brief with priorities and open questions.')}
                  className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                >
                  Summarize to chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearEntries()
                    onPreviewFocus(null)
                  }}
                  disabled={entries.length === 0}
                  className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                >
                  Clear memory
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">New note</div>
                <input
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Memory title"
                  className="mt-3 w-full rounded-2xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none"
                />
                <textarea
                  value={noteContent}
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder="Capture durable context, decisions, or reminders here."
                  className="mt-3 min-h-28 w-full rounded-2xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none"
                />
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={!noteContent.trim()}
                  className="mt-3 rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                >
                  Save note
                </button>
              </div>

              {entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  No saved memory yet. Create a note or capture recent artifacts, chat, or runtime events to build a reusable memory deck.
                </div>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      selectEntry(entry.id)
                      onPreviewFocus({
                        title: entry.title,
                        body: entry.content,
                        metadata: [entry.sourceLabel, formatTimestamp(entry.updatedAt)],
                        mode: 'message',
                      })
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${selectedEntry?.id === entry.id ? 'border-claude-text bg-white' : 'border-claude-border bg-stone-50 hover:bg-white'}`}
                  >
                    <div className="text-sm font-semibold text-claude-text">{entry.title}</div>
                    <div className="mt-1 text-xs text-claude-secondary">{entry.sourceLabel} · {formatTimestamp(entry.updatedAt)}</div>
                    <div className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-claude-secondary">{entry.content}</div>
                  </button>
                ))
              )}
            </div>
          </section>

          <div className="grid gap-5">
            <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Selected memory</div>
                  <div className="mt-1 text-sm text-claude-secondary">Inspect one saved memory item and send it back into chat.</div>
                </div>
                {selectedEntry ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onUsePrompt(`Use this saved memory in the current conversation.\n\nTitle: ${selectedEntry.title}\nSource: ${selectedEntry.sourceLabel}\n\n${selectedEntry.content}`)}
                      className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                    >
                      Open in chat
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEntry(selectedEntry.id)}
                      className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedEntry ? (
                <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4">
                  <div className="text-sm font-semibold text-claude-text">{selectedEntry.title}</div>
                  <div className="mt-1 text-xs text-claude-secondary">{selectedEntry.sourceLabel} · {formatTimestamp(selectedEntry.updatedAt)}</div>
                  <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-claude-text">{selectedEntry.content}</div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  Select or create a memory entry to inspect it here.
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Conversation memory</div>
                  <div className="mt-1 text-sm text-claude-secondary">Recent messages that still shape the current task.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUsePrompt('Summarize the recent conversation into memory items, decisions, and next steps.')}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                  >
                    Distill history
                  </button>
                  <button
                    type="button"
                    onClick={captureLatestMessage}
                    disabled={recentMessages.length === 0}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                  >
                    Capture latest
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {recentMessages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                    No conversation history yet.
                  </div>
                ) : (
                  recentMessages.map((message) => (
                    <div key={message.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">{message.role} · {formatTimestamp(message.createdAt)}</div>
                      <div className="mt-2 line-clamp-5 whitespace-pre-wrap text-sm text-claude-text">{message.content}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Runtime traces</div>
                  <div className="mt-1 text-sm text-claude-secondary">Recent workspace actions that affected routing, tools, and artifacts.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={captureLatestRuntime}
                    disabled={recentEvents.length === 0}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                  >
                    Capture latest
                  </button>
                  <button
                    type="button"
                    onClick={captureLatestArtifact}
                    disabled={recentArtifacts.length === 0}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                  >
                    Capture artifact
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {recentEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                    No runtime traces captured yet.
                  </div>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                      <div className="text-sm font-semibold text-claude-text">{event.title}</div>
                      <div className="mt-1 text-xs text-claude-secondary">{event.kind} · {event.status} · {formatTimestamp(event.createdAt)}</div>
                      <div className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-claude-secondary">{event.detail}</div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  )
}