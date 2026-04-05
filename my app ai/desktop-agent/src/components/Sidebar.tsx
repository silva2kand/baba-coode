import { useSettingsStore } from '../store/settings'
import type { ChatSession } from '../store/chat'
import type { WorkspacePanel } from '../types/workspace'

type SidebarProps = {
  open: boolean
  activePanel: WorkspacePanel
  onPanelChange: (panel: WorkspacePanel) => void
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
  activeSessionId: string | null
  sessions: ChatSession[]
  widthClass?: string
}

type NavItem = {
  panel: WorkspacePanel
  title: string
  description: string
  state: 'live' | 'available' | 'blocked'
}

const quickIcons: Array<{ panel: WorkspacePanel; icon: string; detail: string }> = [
  { panel: 'chat', icon: '💬', detail: 'Open chat surface' },
  { panel: 'search', icon: '🔎', detail: 'Open search surface' },
  { panel: 'tasks', icon: '✓', detail: 'Open tasks queue' },
  { panel: 'coding', icon: '</>', detail: 'Open coding workspace' },
  { panel: 'settings', icon: '⚙', detail: 'Open settings panel' },
]

export function Sidebar({
  open,
  activePanel,
  onPanelChange,
  onNewChat,
  onSelectSession,
  activeSessionId,
  sessions,
  widthClass = 'w-72',
}: SidebarProps) {
  const { agents, tools } = useSettingsStore()

  if (!open) {
    return null
  }

  const coreNavItems: NavItem[] = [
    { panel: 'chat', title: 'Chats', description: 'Start a new conversation or continue recent threads.', state: 'live' },
    { panel: 'search', title: 'Search', description: 'Search chats, files, tools, and saved context.', state: tools.webFetch.available || tools.fileTools.available ? 'live' : 'available' },
    { panel: 'console', title: 'Console', description: 'Runtime log, command traces, and CLI-style surfaces inside Baba.', state: 'live' },
    { panel: 'memory', title: 'Memory', description: 'Saved context, recent traces, and reusable working memory.', state: 'live' },
    { panel: 'customize', title: 'Customize', description: 'Skills, connectors, and personal plugins.', state: 'live' },
    { panel: 'projects', title: 'Projects', description: 'Workspace cards for office, browser, code, and agent workflows.', state: agents.business.available ? 'live' : 'available' },
    { panel: 'artifacts', title: 'Artifacts', description: 'Collected files, pages, media, and generated outputs.', state: agents.imageVideoAnalysis.available ? 'live' : 'available' },
    { panel: 'images', title: 'Vision', description: 'Multimodal image, screenshot, and document analysis.', state: agents.imageVideoAnalysis.available ? 'live' : 'available' },
    { panel: 'coding', title: 'Code', description: 'Implementation planning and developer support.', state: agents.coding.available ? (agents.coding.enabled ? 'live' : 'available') : 'blocked' },
  ]

  const specialistNavItems: NavItem[] = [
    { panel: 'reasoning', title: 'Reasoning', description: 'Deep analysis, structured breakdowns, and long-form thinking.', state: agents.reasoning.available ? 'live' : 'available' },
    { panel: 'tools', title: 'Tools', description: 'Research, shell, file, and multimodal tool surfaces.', state: tools.fileTools.available || tools.webFetch.available ? 'live' : 'available' },
    { panel: 'business', title: 'Business', description: 'Dedicated workspace for briefs, planning, and execution.', state: agents.business.available ? 'live' : 'available' },
    { panel: 'legal', title: 'Legal', description: 'Contracts, clause review, and legal drafting workflows.', state: agents.legal.available ? 'available' : 'blocked' },
    { panel: 'accounting', title: 'Accounting', description: 'Receipts, monthly summaries, and finance workflows.', state: agents.accounting.available ? 'available' : 'blocked' },
    { panel: 'settings', title: 'Settings', description: 'Models, privacy, voice, and desktop behavior controls.', state: 'live' },
  ]

  const agentNavItems: NavItem[] = [
    { panel: 'computer', title: 'Computer', description: 'Screen capture, mouse, keyboard, and app control.', state: 'live' },
    { panel: 'browser', title: 'Browser', description: 'Playwright-controlled browser for web automation.', state: 'live' },
    { panel: 'tasks', title: 'Tasks', description: 'Autonomous task queue with approvals and retries.', state: 'live' },
    { panel: 'dispatch', title: 'Dispatch', description: 'Mobile-to-desktop task handoff and timed execution.', state: 'live' },
  ]

  const buttonClass = (panel: WorkspacePanel) =>
    `w-full rounded-2xl border px-3 py-3 text-left text-sm transition ${activePanel === panel ? 'border-claude-text bg-white text-claude-text shadow-sm' : 'border-transparent text-claude-secondary hover:border-claude-border hover:bg-white'}`

  const stateClass = (state: NavItem['state']) =>
    state === 'live' ? 'bg-emerald-50 text-emerald-700' : state === 'available' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'

  const recentSessions = [...sessions]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 8)

  const renderNavSection = (title: string, items: NavItem[]) => (
    <>
      <div className="mt-4 px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">{title}</div>
      </div>
      <nav className="mt-2 space-y-1">
        {items.map((item) => (
          <button key={item.panel} type="button" className={buttonClass(item.panel)} onClick={() => onPanelChange(item.panel)}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{item.title}</div>
              <div className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${stateClass(item.state)}`}>
                {item.state === 'live' ? 'Live' : item.state === 'available' ? 'Ready' : 'Blocked'}
              </div>
            </div>
            <div className="mt-1 text-xs opacity-70">{item.description}</div>
          </button>
        ))}
      </nav>
    </>
  )

  return (
    <aside className={`flex ${widthClass} min-h-0 flex-col overflow-hidden border-r border-claude-border bg-[#f7f3ea] px-3 py-4 transition-[width] duration-300`}>
      <div className="mb-3 px-2">
        <div className="text-sm font-semibold text-claude-text">SILVA Command Center</div>
        <div className="mt-2 flex items-center gap-1">
          {quickIcons.map((item) => (
            <button
              key={item.panel}
              type="button"
              onClick={() => onPanelChange(item.panel)}
              title={item.detail}
              className={`rounded-lg border px-2 py-1 text-xs transition ${
                activePanel === item.panel
                  ? 'border-claude-text bg-white text-claude-text'
                  : 'border-transparent text-claude-secondary hover:border-claude-border hover:bg-white hover:text-claude-text'
              }`}
            >
              {item.icon}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onNewChat}
        className="mb-2 flex items-center gap-3 rounded-2xl border border-transparent bg-white px-3 py-3 text-left text-sm font-medium text-claude-text shadow-sm"
      >
        <span className="text-lg leading-none">+</span>
        <span>New chat</span>
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {renderNavSection('Primary', coreNavItems)}
        {renderNavSection('Specialists', specialistNavItems)}
        {renderNavSection('Agent Controls', agentNavItems)}

        <div className="mt-5 px-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Recent Chats</div>
          <div className="mt-3 space-y-1">
            {recentSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={`w-full rounded-xl px-2 py-2 text-left text-sm transition ${activeSessionId === session.id ? 'bg-white text-claude-text shadow-sm' : 'text-claude-secondary hover:bg-white hover:text-claude-text'}`}
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="mt-1 truncate text-[11px] opacity-70">{session.messages.at(-1)?.content || 'Empty conversation'}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}
