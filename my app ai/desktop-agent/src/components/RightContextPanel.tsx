import { useMemo } from 'react'
import { PreviewRenderer } from './PreviewRenderer'
import { useArtifactStore } from '../store/artifacts'
import { useChatStore } from '../store/chat'
import { useRuntimeStore } from '../store/runtime'
import { useSettingsStore } from '../store/settings'
import { useWorkspaceStore } from '../store/workspace'
import type { WorkspacePanel } from '../types/workspace'

type RightContextPanelProps = {
  activePanel: WorkspacePanel
  effectiveLayout: string
  widthClass?: string
}

function countEnabledFeatures(collection: Record<string, { enabled: boolean }>) {
  return Object.values(collection).filter((feature) => feature.enabled).length
}

export function RightContextPanel({ activePanel, effectiveLayout, widthClass = 'xl:w-80' }: RightContextPanelProps) {
  const { messages, activeProviderId, providers } = useChatStore()
  const { artifacts, selectedArtifactId } = useArtifactStore()
  const { events } = useRuntimeStore()
  const { models, agents, dataSources, tools, privacy } = useSettingsStore()
  const { activeIntent, previewFocus } = useWorkspaceStore()

  const selectedArtifact = useMemo(
    () => artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null,
    [artifacts, selectedArtifactId],
  )

  const stats = useMemo(
    () => ({
      enabledAgents: countEnabledFeatures(agents),
      enabledDataSources: countEnabledFeatures(dataSources),
      enabledTools: countEnabledFeatures(tools),
      enabledPrivacyGuards: countEnabledFeatures(privacy),
    }),
    [agents, dataSources, tools, privacy],
  )

  const latestRuntimeEvent = events[0] ?? null
  const latestMessage = messages[messages.length - 1] ?? null
  const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers.find((provider) => provider.active) ?? null

  return (
    <aside className={`hidden overflow-y-auto border-l border-claude-border bg-white p-4 xl:flex xl:flex-col xl:gap-4 ${widthClass}`}>
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
          <div className="text-xs text-claude-secondary">
            {activeProvider?.detail || 'Offline fallback provider is active.'}
          </div>
          <div className="flex items-center justify-between">
            <span>Routing preset</span>
            <span className="font-medium">{models.routingPreset}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Layout</span>
            <span className="font-medium">{effectiveLayout}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Router source</span>
            <span className="font-medium">{activeIntent?.source || 'idle'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Tool bridge</span>
            <span className="font-medium">{tools.webFetch.available || tools.fileTools.available ? 'live' : 'blocked'}</span>
          </div>
          {activeIntent ? (
            <div className="text-xs text-claude-secondary">
              {activeIntent.reason}
            </div>
          ) : null}
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
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Preview</div>
        <div className="mt-3">
          <PreviewRenderer activePanel={activePanel} previewFocus={previewFocus} selectedArtifact={selectedArtifact} latestRuntimeEvent={latestRuntimeEvent} latestMessage={latestMessage} />
        </div>
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Conversation</div>
        <div className="mt-3 text-sm text-claude-secondary">
          {messages.length === 0 ? 'No chat context yet.' : `${messages.length} messages in the active transcript.`}
        </div>
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Runtime Console</div>
        {latestRuntimeEvent ? (
          <div className="mt-3 space-y-2 text-sm text-claude-secondary">
            <div className="font-medium text-claude-text">{latestRuntimeEvent.title}</div>
            <div>{latestRuntimeEvent.kind} · {latestRuntimeEvent.status} · {latestRuntimeEvent.panel}</div>
            <div className="line-clamp-5 whitespace-pre-wrap">{latestRuntimeEvent.detail}</div>
            <div className="text-xs">Events stored: {events.length}</div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-claude-secondary">No runtime events captured yet.</div>
        )}
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Selected Artifact</div>
        {selectedArtifact ? (
          <div className="mt-3 space-y-2 text-sm text-claude-secondary">
            <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
            <div>
              {selectedArtifact.kind === 'research'
                ? selectedArtifact.sourceUrl
                : selectedArtifact.kind === 'file'
                  ? selectedArtifact.path
                  : selectedArtifact.kind === 'web'
                    ? selectedArtifact.url
                    : selectedArtifact.kind === 'media'
                      ? `${selectedArtifact.mimeType || 'unknown'} · ${selectedArtifact.size.toLocaleString()} bytes`
                      : `${selectedArtifact.role} · ${new Date(selectedArtifact.messageCreatedAt).toLocaleString()}`}
            </div>
            <div className="line-clamp-6 whitespace-pre-wrap">
              {selectedArtifact.kind === 'research'
                ? selectedArtifact.summary
                : selectedArtifact.kind === 'file'
                  ? selectedArtifact.content
                  : selectedArtifact.kind === 'web'
                    ? selectedArtifact.preview
                    : selectedArtifact.kind === 'media'
                      ? selectedArtifact.previewText
                      : selectedArtifact.content}
            </div>
            <div className="text-xs">Artifacts stored: {artifacts.length}</div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-claude-secondary">No artifact selected yet.</div>
        )}
      </section>

      <section className="rounded-2xl border border-claude-border p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Agent Visibility</div>
        <div className="mt-3 space-y-2 text-sm text-claude-secondary">
          <div>Business: {agents.business.available ? 'visible' : 'blocked'}</div>
          <div>Legal: {agents.legal.available ? 'visible' : 'blocked'}</div>
          <div>Accounting: {agents.accounting.available ? 'visible' : 'blocked'}</div>
          <div>Images: {agents.imageVideoAnalysis.available ? 'visible' : 'blocked'}</div>
        </div>
      </section>
    </aside>
  )
}