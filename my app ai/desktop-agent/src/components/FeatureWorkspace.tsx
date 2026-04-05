import { useEffect } from 'react'
import type { PreviewFocusMode, WorkspacePanel } from '../types/workspace'

type FeatureWorkspaceProps = {
  panel: WorkspacePanel
  title: string
  summary: string
  available: boolean
  enabled: boolean
  blockedReason?: string
  prompts: string[]
  onUsePrompt: (prompt: string) => void
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

export function FeatureWorkspace({
  panel,
  title,
  summary,
  available,
  enabled,
  blockedReason,
  prompts,
  onUsePrompt,
  onPreviewFocus,
}: FeatureWorkspaceProps) {
  useEffect(() => {
    onPreviewFocus({
      title,
      body: summary,
      metadata: [panel, available ? (enabled ? 'Enabled' : 'Available') : 'Blocked', blockedReason || 'Prompt starters available below'],
      mode: 'route',
    })
  }, [available, blockedReason, enabled, onPreviewFocus, panel, summary, title])

  return (
    <section className="h-full overflow-auto bg-stone-50/70 p-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-3xl border border-claude-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-claude-secondary">
            <span>{panel}</span>
            <span className={`rounded-full px-2 py-1 ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {available ? (enabled ? 'Enabled' : 'Available') : 'Blocked'}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-claude-text">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm text-claude-secondary">{summary}</p>
          {!available && blockedReason ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {blockedReason}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Starter prompts</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onUsePrompt(prompt)}
                  className="rounded-2xl border border-claude-border bg-stone-50 p-4 text-left text-sm text-claude-text transition hover:border-claude-text hover:bg-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Surface notes</div>
            <div className="mt-4 space-y-3 text-sm text-claude-secondary">
              <div>This panel stays visible even when a feature is blocked, so the workspace does not hide capability gaps.</div>
              <div>Use the global command bar to jump between panels or send the selected prompt straight into command chat.</div>
              <div>Settings still control the runtime toggle state, but the navigation now exposes every surface directly.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}