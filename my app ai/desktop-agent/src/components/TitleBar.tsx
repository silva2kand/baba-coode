import { useEffect, useMemo, useState } from 'react'
import type { ProviderSummary } from '../store/chat'
import type { WorkspacePanel } from '../types/workspace'

const workspaceOptions: Array<{ panel: WorkspacePanel; label: string }> = [
  { panel: 'chat', label: 'Chat' },
  { panel: 'search', label: 'Search' },
  { panel: 'console', label: 'Console' },
  { panel: 'memory', label: 'Memory' },
  { panel: 'coding', label: 'Code' },
  { panel: 'tasks', label: 'Tasks' },
  { panel: 'dispatch', label: 'Dispatch' },
  { panel: 'browser', label: 'Browser' },
  { panel: 'computer', label: 'Computer' },
  { panel: 'settings', label: 'Settings' },
]

const commandShortcuts = [
  { label: 'Prompt', value: '' },
  { label: '/plan', value: '/plan' },
  { label: '/status', value: '/status' },
  { label: '/summarize', value: '/summarize' },
  { label: '/rewrite', value: '/rewrite' },
]

type TitleBarProps = {
  activePanel: WorkspacePanel
  providers: ProviderSummary[]
  activeProviderId: string | null
  selectedModel: string
  onNavigate: (panel: WorkspacePanel) => void
  onProviderChange: (providerId: string) => void
  onModelChange: (model: string) => void
  onSearchSubmit: (query: string) => void
  onCommandShortcut: (command: string) => void
  onToggleSidebar: () => void
  onToggleRightPanel: () => void
  onBack: () => void
  onForward: () => void
  canGoBack: boolean
  canGoForward: boolean
}

export function TitleBar({
  activePanel,
  providers,
  activeProviderId,
  selectedModel,
  onNavigate,
  onProviderChange,
  onModelChange,
  onSearchSubmit,
  onCommandShortcut,
  onToggleSidebar,
  onToggleRightPanel,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
}: TitleBarProps) {
  const [searchDraft, setSearchDraft] = useState('')
  const [selectedShortcut, setSelectedShortcut] = useState('')
  const handleMinimize = () => window.electronAPI?.minimize()
  const handleMaximize = () => window.electronAPI?.maximize()
  const handleClose = () => window.electronAPI?.close()

  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers.find((provider) => provider.active) ?? providers[0] ?? null
  const modelOptions = useMemo(() => (activeProvider?.models.length ? activeProvider.models : ['local-guidance']), [activeProvider])

  useEffect(() => {
    if (!modelOptions.includes(selectedModel)) {
      onModelChange(modelOptions[0])
    }
  }, [modelOptions, onModelChange, selectedModel])

  const submitSearch = () => {
    const query = searchDraft.trim()
    if (!query) {
      return
    }

    onSearchSubmit(query)
    setSearchDraft('')
  }

  const runShortcut = (value: string) => {
    setSelectedShortcut(value)
    if (!value) {
      return
    }
    onCommandShortcut(value)
    setSelectedShortcut('')
  }

  return (
    <header className="app-drag-region border-b border-claude-border bg-[#f7f3ea] px-3 py-2">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2">
        <div className="app-no-drag flex items-center gap-1.5 text-claude-secondary">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg border border-transparent px-2 py-1 text-xs font-medium transition hover:border-claude-border hover:bg-white hover:text-claude-text"
            title="Toggle sidebar"
          >
            ☰
          </button>
          <button type="button" onClick={onToggleRightPanel} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-claude-border hover:bg-white hover:text-claude-text" title="Toggle context panel">◧</button>
          <button type="button" onClick={onBack} disabled={!canGoBack} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-claude-border hover:bg-white hover:text-claude-text disabled:cursor-not-allowed disabled:opacity-40" title="Back">←</button>
          <button type="button" onClick={onForward} disabled={!canGoForward} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-claude-border hover:bg-white hover:text-claude-text disabled:cursor-not-allowed disabled:opacity-40" title="Forward">→</button>
        </div>

        <div className="flex min-w-[130px] items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-claude-secondary">
          <span className="rounded-md border border-claude-border bg-white/70 px-3 py-1" title="Drag the app window from this region">Drag Window</span>
        </div>

        <div className="app-no-drag flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden">
          <label className="hidden items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1 text-[11px] text-claude-secondary md:flex">
            <span className="font-medium">Go to</span>
            <select
              value={activePanel}
              onChange={(event) => onNavigate(event.target.value as WorkspacePanel)}
              className="bg-transparent text-[11px] font-medium text-claude-text outline-none"
              title="Go to surface"
            >
              {workspaceOptions.map((option) => (
                <option key={option.panel} value={option.panel}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1 text-[11px] text-claude-secondary">
            <span className="font-medium">Provider</span>
            <select
              value={activeProvider?.id || ''}
              onChange={(event) => onProviderChange(event.target.value)}
              className="max-w-[120px] truncate bg-transparent text-[11px] font-medium text-claude-text outline-none"
              title="Active provider"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.available}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1 text-[11px] text-claude-secondary">
            <span className="font-medium">Model</span>
            <select
              value={modelOptions.includes(selectedModel) ? selectedModel : modelOptions[0]}
              onChange={(event) => onModelChange(event.target.value)}
              className="max-w-[170px] truncate bg-transparent text-[11px] font-medium text-claude-text outline-none"
              title="Active model"
            >
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1 text-[11px] text-claude-secondary">
            <span className="font-medium">Command</span>
            <select
              value={selectedShortcut}
              onChange={(event) => runShortcut(event.target.value)}
              className="bg-transparent text-[11px] font-medium text-claude-text outline-none"
              title="Run a command shortcut"
            >
              {commandShortcuts.map((shortcut) => (
                <option key={shortcut.label} value={shortcut.value}>
                  {shortcut.label}
                </option>
              ))}
            </select>
          </label>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitSearch()
            }}
            className="flex min-w-[180px] flex-1 items-center gap-1 rounded-lg border border-claude-border bg-white px-2 py-1"
            title="Run URL or web query research in the Search workspace"
          >
            <span className="rounded-md border border-claude-border bg-stone-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-claude-secondary">
              Web
            </span>
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Web search (URL or query)..."
              className="min-w-0 flex-1 bg-transparent text-[11px] text-claude-text outline-none placeholder:text-claude-secondary"
            />
            <button type="submit" className="rounded-md bg-claude-text px-2 py-1 text-[10px] font-semibold text-white">
              Search
            </button>
          </form>
        </div>

        <div className="app-no-drag flex items-center gap-1 text-claude-secondary">
          <button type="button" onClick={handleMinimize} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-claude-border hover:bg-white hover:text-claude-text" title="Minimize">—</button>
          <button type="button" onClick={handleMaximize} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-claude-border hover:bg-white hover:text-claude-text" title="Maximize">□</button>
          <button type="button" onClick={handleClose} className="rounded-lg border border-transparent px-2 py-1 text-xs transition hover:border-red-300 hover:bg-red-50 hover:text-red-600" title="Close">✕</button>
        </div>
      </div>
    </header>
  )
}
