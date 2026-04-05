import { useState } from 'react'
import type { WorkspacePanel } from '../types/workspace'

const quickPanels: Array<{ panel: WorkspacePanel; label: string; detail: string }> = [
  { panel: 'chat', label: 'Chat', detail: 'Open the conversation surface.' },
  { panel: 'tasks', label: 'Tasks', detail: 'Open multi-step task queue and approvals.' },
  { panel: 'browser', label: 'Browser', detail: 'Open browser automation tools.' },
  { panel: 'computer', label: 'Computer', detail: 'Open desktop control tools.' },
  { panel: 'console', label: 'Console', detail: 'Open runtime logs and traces.' },
  { panel: 'settings', label: 'Settings', detail: 'Open app settings and routing controls.' },
]

type CommandBarProps = {
  activePanel: WorkspacePanel
  onNavigate: (panel: WorkspacePanel) => void
  onSubmitCommand: (value: string) => Promise<void> | void
}

export function CommandBar({ activePanel, onNavigate, onSubmitCommand }: CommandBarProps) {
  const [value, setValue] = useState('')

  const submit = async (mode: 'prompt' | 'command') => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    const commandValue = mode === 'command' && !trimmed.startsWith('/') ? `/${trimmed}` : trimmed
    await onSubmitCommand(commandValue)
    setValue('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submit('prompt')
  }

  return (
    <section className="border-b border-claude-border bg-white/95 px-3 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-claude-border bg-stone-50 px-2 py-1.5 shadow-sm">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Type a prompt. Use Run for command mode..."
            className="flex-1 bg-transparent text-sm text-claude-text outline-none placeholder:text-claude-secondary"
          />

          <button type="submit" className="rounded-md border border-claude-border bg-white px-3 py-1.5 text-xs font-semibold text-claude-text">
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              void submit('command')
            }}
            className="rounded-md bg-claude-text px-3 py-1.5 text-xs font-semibold text-white"
            title="Runs as a slash command. Example: status => /status"
          >
            Run
          </button>
        </form>
        <div className="text-[11px] text-claude-secondary">
          Send = prompt to chat. Run = slash command. Header Search = web/URL research.
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {quickPanels.map((item) => (
            <button
              key={item.panel}
              type="button"
              onClick={() => onNavigate(item.panel)}
              title={item.detail}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                activePanel === item.panel
                  ? 'border-claude-text bg-claude-text text-white'
                  : 'border-claude-border bg-white text-claude-text hover:border-claude-text'
              }`}
            >
              {item.label}
            </button>
          ))}
          <span className="ml-auto hidden text-[11px] text-claude-secondary lg:inline">
            Active surface: {activePanel}
          </span>
        </div>
      </div>
    </section>
  )
}
