import { useEffect, useState } from 'react'
import type { PreviewFocusMode } from '../types/workspace'

const connectorItems = [
  { name: 'GitHub Integration', summary: 'Repositories, PRs, issues, and code context.', status: 'Not connected' },
  { name: 'Gmail', summary: 'Summaries and email context from linked inboxes.', status: 'Not connected' },
  { name: 'Google Drive', summary: 'Search documents and shared folders.', status: 'Not connected' },
]

type CustomizeWorkspaceProps = {
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

export function CustomizeWorkspace({ onPreviewFocus }: CustomizeWorkspaceProps) {
  const [activeConnector, setActiveConnector] = useState(connectorItems[0])

  useEffect(() => {
    onPreviewFocus({
      title: activeConnector.name,
      body: `${activeConnector.summary}\nStatus: ${activeConnector.status}`,
      metadata: ['Customize surface', 'Connector detail'],
      mode: 'route',
    })
  }, [activeConnector, onPreviewFocus])

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-5">
      <div className="mx-auto grid h-full max-w-7xl gap-4 rounded-[28px] border border-claude-border bg-white shadow-sm lg:grid-cols-[240px_320px_1fr]">
        <aside className="border-r border-claude-border p-5">
          <div className="text-2xl font-semibold text-claude-text">Customize</div>
          <div className="mt-6 space-y-2">
            <button type="button" className="w-full rounded-2xl px-3 py-3 text-left text-sm font-medium text-claude-secondary transition hover:bg-stone-50">
              Skills
            </button>
            <button type="button" className="w-full rounded-2xl bg-[#f1ede3] px-3 py-3 text-left text-sm font-semibold text-claude-text">
              Connectors
            </button>
          </div>

          <div className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Personal plugins</div>
          <div className="mt-3 rounded-2xl border border-claude-border bg-stone-50 px-3 py-3 text-sm text-claude-secondary">Legal</div>
        </aside>

        <section className="border-r border-claude-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-claude-text">Connectors</div>
              <div className="mt-1 text-sm text-claude-secondary">Not connected</div>
            </div>
            <div className="flex gap-2 text-lg text-claude-secondary">
              <span>⌕</span>
              <span>＋</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {connectorItems.map((connector) => (
              <button
                key={connector.name}
                type="button"
                onClick={() => setActiveConnector(connector)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${activeConnector.name === connector.name ? 'bg-[#f1ede3] text-claude-text' : 'bg-white text-claude-secondary hover:bg-stone-50'}`}
              >
                <div className="text-sm font-medium">{connector.name}</div>
                <div className="mt-1 text-xs opacity-70">{connector.summary}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-10 text-center">
          <div className="max-w-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-claude-border bg-white text-4xl shadow-sm">◎</div>
            <div className="mt-6 text-3xl font-semibold text-claude-text">{activeConnector.name}</div>
            <div className="mt-3 text-base text-claude-secondary">You are not connected to {activeConnector.name} yet.</div>
            <button type="button" className="mt-6 rounded-2xl bg-black px-6 py-3 text-sm font-medium text-white">Connect</button>
          </div>
        </section>
      </div>
    </section>
  )
}