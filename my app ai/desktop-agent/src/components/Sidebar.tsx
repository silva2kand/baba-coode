type SidebarProps = {
  open: boolean
  activePanel: 'chat' | 'settings'
  onPanelChange: (panel: 'chat' | 'settings') => void
}

export function Sidebar({ open, activePanel, onPanelChange }: SidebarProps) {
  if (!open) {
    return null
  }

  const buttonClass = (panel: 'chat' | 'settings') =>
    `w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${activePanel === panel ? 'border-claude-text bg-white text-claude-text shadow-sm' : 'border-transparent text-claude-secondary hover:border-claude-border hover:bg-white'}`

  return (
    <aside className="flex w-72 flex-col border-r border-claude-border bg-claude-sidebar p-3">
      <div className="mb-4 rounded-2xl border border-claude-border bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Workspace</div>
        <div className="mt-2 text-sm text-claude-text">Local-first command center with an offline assistant and provider scaffolding.</div>
      </div>

      <nav className="space-y-2">
        <button type="button" className={buttonClass('chat')} onClick={() => onPanelChange('chat')}>
          <div className="font-medium">Command Chat</div>
          <div className="mt-1 text-xs opacity-70">Use the built-in assistant and quick commands.</div>
        </button>
        <button type="button" className={buttonClass('settings')} onClick={() => onPanelChange('settings')}>
          <div className="font-medium">Settings Hub</div>
          <div className="mt-1 text-xs opacity-70">Models, agents, tools, privacy, layout, voice, and developer controls.</div>
        </button>
      </nav>

      <div className="mt-auto rounded-2xl border border-claude-border bg-white p-4 text-xs text-claude-secondary shadow-sm">
        Tip: start with /help or /plan in the chat panel.
      </div>
    </aside>
  )
}
