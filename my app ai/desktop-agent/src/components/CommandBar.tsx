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
  const [panelJump, setPanelJump] = useState('')

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
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1.5">
        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl border border-claude-border bg-stone-50 px-2 py-1.5 shadow-sm">
          <label className="hidden items-center gap-1 rounded-md border border-claude-border bg-white px-2 py-1 text-[11px] text-claude-secondary md:flex">
            <span className="font-semibold uppercase tracking-[0.12em]">Open</span>
            <select
              value={panelJump}
              onChange={(event) => {
                const nextPanel = event.target.value as WorkspacePanel
                setPanelJump(nextPanel)
                if (nextPanel) {
                  onNavigate(nextPanel)
                  setPanelJump('')
                }
              }}
              className="bg-transparent text-[11px] font-medium text-claude-text outline-none"
            >
              <option value="">Surface</option>
              {quickPanels.map((item) => (
                <option key={item.panel} value={item.panel}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

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
        <div className="flex items-center justify-between gap-3 text-[11px] text-claude-secondary">
          <span>Open menu jumps to Tasks/Browser/Computer/Console/Settings without blocking chat.</span>
          <span className="hidden lg:inline">Active surface: {activePanel}</span>
        </div>
        <div className="text-[11px] text-claude-secondary">
          Send = prompt to chat. Run = slash command. Header Search = web/URL research.
        </div>
      </div>
    </section>
  )
}
