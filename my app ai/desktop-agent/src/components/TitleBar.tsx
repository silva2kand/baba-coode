type TitleBarProps = {
  onToggleSidebar: () => void
}

export function TitleBar({ onToggleSidebar }: TitleBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-claude-border bg-white px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-claude-text">SILVA AI Command Center</div>
        <div className="text-xs text-claude-secondary">Unified command window with one settings hub for models, agents, tools, privacy, and layout</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
          Local mode active
        </div>
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text transition hover:border-claude-accent hover:text-claude-accent"
        >
          Toggle Sidebar
        </button>
      </div>
    </header>
  )
}
