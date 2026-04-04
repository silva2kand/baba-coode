import { useState } from 'react'
import { useChatStore } from '../store/chat'

const quickPrompts = [
  { label: 'Plan work', value: '/plan rebuild the desktop-agent app into a useful command center' },
  { label: 'Summarize notes', value: '/summarize Paste rough notes here to condense them into a short summary.' },
  { label: 'Rewrite text', value: '/rewrite this app feels unfinished and needs a clearer workflow and stronger UI' },
  { label: 'Show status', value: '/status' },
]

export function ChatWindow() {
  const [draft, setDraft] = useState('')
  const { messages, sendMessage, isReady, isResponding, activeProviderId } = useChatStore()

  const send = async () => {
    const text = draft.trim()
    if (!text) {
      return
    }
    await sendMessage(text)
    setDraft('')
  }

  const handleQuickPrompt = (value: string) => {
    setDraft(value)
  }

  return (
    <section className="flex h-full flex-col bg-white">
      <div className="border-b border-claude-border bg-gradient-to-r from-white to-amber-50 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-claude-text">Command Workspace</div>
            <div className="mt-1 text-sm text-claude-secondary">
              Local assistant is enabled, so the app can respond even before external providers are wired.
            </div>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            {isReady ? `Ready via ${activeProviderId || 'local'}` : 'Initializing'}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              onClick={() => handleQuickPrompt(prompt.value)}
              className="rounded-full border border-claude-border bg-white px-3 py-1.5 text-xs font-medium text-claude-text transition hover:border-claude-accent hover:text-claude-accent"
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-stone-50/70 p-5">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
          {messages.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-claude-border bg-white p-4 text-left shadow-sm">
                <div className="text-sm font-semibold text-claude-text">Useful right now</div>
                <div className="mt-2 text-sm text-claude-secondary">
                  The shell now supports local commands, provider status, and persistent transcript flow.
                </div>
              </div>
              <div className="rounded-2xl border border-claude-border bg-white p-4 text-left shadow-sm">
                <div className="text-sm font-semibold text-claude-text">Try a command</div>
                <div className="mt-2 text-sm text-claude-secondary">
                  Use /help, /plan, /summarize, /rewrite, or /status in the input box.
                </div>
              </div>
              <div className="rounded-2xl border border-claude-border bg-white p-4 text-left shadow-sm">
                <div className="text-sm font-semibold text-claude-text">Provider mode</div>
                <div className="mt-2 text-sm text-claude-secondary">
                  Offline Assistant is the default active provider until real remote integrations are configured.
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'ml-auto max-w-3xl rounded-2xl bg-claude-text px-4 py-3 text-sm text-white shadow-sm'
                    : 'max-w-3xl rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm text-claude-text shadow-sm'
                }
              >
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">
                  {message.role}
                </div>
                <div className="whitespace-pre-wrap leading-6">{message.content}</div>
              </article>
            ))
          )}

          {isResponding ? (
            <div className="max-w-3xl rounded-2xl border border-claude-border bg-white px-4 py-3 text-left text-sm text-claude-secondary shadow-sm">
              Assistant is thinking...
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-claude-border bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div className="rounded-3xl border border-claude-border bg-claude-input p-2 shadow-sm">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="max-h-40 min-h-[52px] flex-1 resize-y bg-transparent px-3 py-2 text-sm text-claude-text outline-none placeholder:text-claude-secondary"
                placeholder="Type a message or try /help"
              />
              <button
                type="button"
                onClick={send}
                disabled={isResponding}
                className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResponding ? 'Working...' : 'Send'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-claude-secondary">
            <div>Quick commands: /help, /plan, /summarize, /rewrite, /status</div>
            <div>{messages.length} messages</div>
          </div>
        </div>
      </div>
    </section>
  )
}
