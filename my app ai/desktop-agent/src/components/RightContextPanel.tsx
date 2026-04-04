import { useMemo } from 'react'
import { useChatStore } from '../store/chat'
import { useSettingsStore } from '../store/settings'

type RightContextPanelProps = {
  activePanel: 'chat' | 'settings'
}

function countEnabledFeatures(collection: Record<string, { enabled: boolean }>) {
  return Object.values(collection).filter((feature) => feature.enabled).length
}

export function RightContextPanel({ activePanel }: RightContextPanelProps) {
  const { messages, activeProviderId } = useChatStore()
  const { models, agents, dataSources, tools, privacy, ui } = useSettingsStore()

  const stats = useMemo(
    () => ({
      enabledAgents: countEnabledFeatures(agents),
      enabledDataSources: countEnabledFeatures(dataSources),
      enabledTools: countEnabledFeatures(tools),
      enabledPrivacyGuards: countEnabledFeatures(privacy),
    }),
    [agents, dataSources, tools, privacy],
  )

  return (
    <aside className="hidden w-80 border-l border-claude-border bg-white p-4 xl:flex xl:flex-col xl:gap-4">
      <section className="rounded-2xl border border-claude-border bg-stone-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Live Context</div>
        <div className="mt-3 space-y-2 text-sm text-claude-text">
          <div className="flex items-center justify-between">
            <span>Active surface</span>
            <span className="font-medium capitalize">{activePanel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Active provider</span>
            <span className="font-medium">{activeProviderId || 'local'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Routing preset</span>
            <span className="font-medium">{models.routingPreset}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Layout</span>
            <span className="font-medium">{ui.layout}</span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Coverage Check</div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-xs text-claude-secondary">Agents</div>
            <div className="mt-1 text-lg font-semibold text-claude-text">{stats.enabledAgents}</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-xs text-claude-secondary">Data Sources</div>
            <div className="mt-1 text-lg font-semibold text-claude-text">{stats.enabledDataSources}</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-xs text-claude-secondary">Tools</div>
            <div className="mt-1 text-lg font-semibold text-claude-text">{stats.enabledTools}</div>
          </div>
          <div className="rounded-xl bg-amber-50 p-3">
            <div className="text-xs text-claude-secondary">Privacy Guards</div>
            <div className="mt-1 text-lg font-semibold text-claude-text">{stats.enabledPrivacyGuards}</div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Conversation</div>
        <div className="mt-3 text-sm text-claude-secondary">
          {messages.length === 0 ? 'No chat context yet.' : `${messages.length} messages in the active transcript.`}
        </div>
      </section>
    </aside>
  )
}