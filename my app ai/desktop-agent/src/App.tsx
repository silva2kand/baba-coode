import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { TitleBar } from './components/TitleBar'
import { SettingsPanel } from './components/SettingsPanel'
import { RightContextPanel } from './components/RightContextPanel'
import { CommandBar } from './components/CommandBar'
import { FeatureWorkspace } from './components/FeatureWorkspace'
import { ArtifactsWorkspace } from './components/ArtifactsWorkspace'
import { CodingWorkspace } from './components/CodingWorkspace'
import { ConsoleWorkspace } from './components/ConsoleWorkspace'
import { MemoryWorkspace } from './components/MemoryWorkspace'
import { ToolsWorkspace } from './components/ToolsWorkspace'
import { MediaWorkspace } from './components/MediaWorkspace'
import { CustomizeWorkspace } from './components/CustomizeWorkspace'
import { SearchWorkspace } from './components/SearchWorkspace'
import { TaskWorkspace } from './components/TaskWorkspace'
import { ComputerViewWorkspace } from './components/ComputerViewWorkspace'
import { BrowserWorkspace } from './components/BrowserWorkspace'
import { DispatchWorkspace } from './components/DispatchWorkspace'
import { createPreviewFocus, detectCommandSurface, detectPromptSurface, isWorkspacePanel } from './lib/surface-router'
import { deriveLayoutState } from './lib/layout-router'
import { useArtifactStore } from './store/artifacts'
import { useChatStore } from './store/chat'
import { useMemoryStore } from './store/memory'
import { useRuntimeStore, type RuntimeEventInput, withRuntimePreview } from './store/runtime'
import { useSearchStore } from './store/search'
import { useSettingsStore } from './store/settings'
import { useWorkspaceStore } from './store/workspace'
import { useTaskStore } from './store/task'
import { queryEngine } from './lib/query-engine'
import type { PreviewFocusMode, WorkspacePanel } from './types/workspace'

type PreviewFocusInput = {
  title: string
  body: string
  metadata?: string[]
  mode?: PreviewFocusMode
}

function App() {
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('chat')
  const [panelHistory, setPanelHistory] = useState<WorkspacePanel[]>(['chat'])
  const [panelHistoryIndex, setPanelHistoryIndex] = useState(0)
  const {
    initStore,
    sendMessage,
    clearMessages,
    providers,
    activeProviderId,
    setActiveProvider,
    refreshProviders,
    sessions,
    activeSessionId,
    createSession,
    selectSession,
  } = useChatStore()
  const addRuntimeEvent = useRuntimeStore((state) => state.addEvent)
  const addMemoryEntry = useMemoryStore((state) => state.addEntry)
  const runtimeEvents = useRuntimeStore((state) => state.events)
  const { artifacts, selectedArtifactId } = useArtifactStore()
  const { hydrate, ui, agents, models, setUiSetting, setModelSetting } = useSettingsStore()
  const requestSearch = useSearchStore((state) => state.requestSearch)
  const setActiveIntent = useWorkspaceStore((state) => state.setActiveIntent)
  const setPreviewFocus = useWorkspaceStore((state) => state.setPreviewFocus)

  useEffect(() => {
    hydrate()
    let disposed = false

    const init = async () => {
      await queryEngine.init(() => {
        if (!disposed) {
          refreshProviders()
        }
      })
      if (!disposed) {
        initStore()
      }
    }
    init()

    const unsubTaskEvent = window.electronAPI.onTaskEvent((event) => {
      useTaskStore.getState().handleIpcTaskEvent(event)
    })

    return () => {
      disposed = true
      unsubTaskEvent()
    }
  }, [hydrate, initStore, refreshProviders])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void queryEngine.reprobeProviders(() => {
        refreshProviders()
      })
    }, 45_000)

    return () => window.clearInterval(timer)
  }, [refreshProviders])

  const fontSizeClass = ui.fontSize === 'sm' ? 'text-[13px]' : ui.fontSize === 'lg' ? 'text-[16px]' : 'text-[14px]'
  const shellClass = ui.theme === 'light' ? 'bg-white' : 'bg-claude-bg'
  const selectedArtifact = artifacts.find((artifact) => artifact.id === selectedArtifactId) ?? artifacts[0] ?? null
  const latestRuntimeEvent = runtimeEvents[0] ?? null
  const layoutState = deriveLayoutState({
    activePanel,
    uiShowRightContextPanel: ui.showRightContextPanel,
    latestRuntimeEvent,
    selectedArtifact,
  })

  const contentContainerClass = layoutState.showSideConsole
    ? 'grid flex-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_24rem]'
    : 'flex-1 flex flex-col overflow-hidden'

  const mainColumnClass = layoutState.showBottomConsole ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1 flex flex-col overflow-hidden'

  useEffect(() => {
    void window.electronAPI.applyWorkspaceLayout(layoutState.effectiveLayout)
  }, [layoutState.effectiveLayout])

  const logRuntimeEvent = (event: RuntimeEventInput) => {
    const runtimeEvent = addRuntimeEvent(event)
    if (runtimeEvent.preview) {
      setPreviewFocus(createPreviewFocus({
        panel: runtimeEvent.panel,
        source: runtimeEvent.source,
        mode: runtimeEvent.preview.mode || 'runtime',
        title: runtimeEvent.preview.title,
        body: runtimeEvent.preview.body,
        metadata: runtimeEvent.preview.metadata,
      }))
    }
  }

  const handleConsolePreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'console', source: 'console-workspace', mode: focus.mode || 'runtime', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleEmbeddedConsolePreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'console', source: 'embedded-console', mode: focus.mode || 'runtime', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleSideConsolePreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'console', source: 'side-console', mode: focus.mode || 'runtime', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleArtifactsPreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'artifacts', source: 'artifacts-workspace', mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleCodingPreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'coding', source: 'coding-workspace', mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleMemoryPreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'memory', source: 'memory-workspace', mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleSettingsPreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'settings', source: 'settings-panel', mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleCustomizePreviewFocus = useCallback((focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel: 'customize', source: 'customize-workspace', mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const handleFeaturePreviewFocus = useCallback((panel: WorkspacePanel, focus: PreviewFocusInput | null) => {
    setPreviewFocus(focus ? createPreviewFocus({ panel, source: `${panel}-workspace`, mode: focus.mode || 'route', title: focus.title, body: focus.body, metadata: focus.metadata }) : null)
  }, [setPreviewFocus])

  const routePanel = (panel: WorkspacePanel, reason: string, source: string, input = '', mode: 'push' | 'replace' = 'push') => {
    setActivePanel(panel)
    if (mode === 'push') {
      setPanelHistory((current) => [...current.slice(0, panelHistoryIndex + 1), panel])
      setPanelHistoryIndex((current) => current + 1)
    }
    setActiveIntent({ panel, reason, source, input })
    logRuntimeEvent({
      ...withRuntimePreview({
        kind: 'route',
        status: 'info',
        title: `Opened ${panel} surface`,
        detail: reason,
        panel,
        source,
      }, {
        title: `Surface: ${panel}`,
        body: input || reason,
        metadata: [reason],
        mode: 'route',
      }),
    })
  }

  const navigateHistory = (direction: 'back' | 'forward') => {
    const nextIndex = direction === 'back' ? panelHistoryIndex - 1 : panelHistoryIndex + 1
    if (nextIndex < 0 || nextIndex >= panelHistory.length) {
      return
    }

    const panel = panelHistory[nextIndex]
    setPanelHistoryIndex(nextIndex)
    routePanel(panel, `Title bar ${direction} navigation opened the ${panel} surface.`, 'title-bar', panel, 'replace')
  }

  const handleCreateSession = () => {
    createSession()
    routePanel('chat', 'Started a new chat session from the shell.', 'sidebar', 'new-chat')
  }

  const handleSelectSession = (sessionId: string) => {
    selectSession(sessionId)
    routePanel('chat', 'Opened a recent chat session from the sidebar.', 'sidebar', sessionId)
  }

  const handleArtifactCreated = (title: string, detail: string) => {
    setActivePanel('artifacts')
    setActiveIntent({ panel: 'artifacts', reason: 'Artifact creation switches focus into the artifacts surface.', source: 'artifact-store', input: title })
    addMemoryEntry({
      kind: 'artifact',
      title,
      content: detail,
      sourceLabel: 'artifact capture',
    })
    logRuntimeEvent({
      ...withRuntimePreview({
        kind: 'artifact',
        status: 'success',
        title,
        detail,
        panel: 'artifacts',
        source: 'artifact-store',
      }, {
        title,
        body: detail,
        metadata: ['Artifact saved'],
        mode: 'route',
      }),
    })
  }

  const sendPromptToChat = async (prompt: string, source = 'chat-prompt') => {
    const decision = detectPromptSurface(prompt)
    if (decision) {
      routePanel(decision.panel, decision.reason, source, prompt)
    } else {
      setActivePanel('chat')
      setActiveIntent({ panel: 'chat', reason: 'Prompt stayed in the main chat surface.', source, input: prompt })
      logRuntimeEvent({
        ...withRuntimePreview({
          kind: 'route',
          status: 'info',
          title: 'Stayed in chat surface',
          detail: 'Prompt stayed in the main chat surface.',
          panel: 'chat',
          source,
        }, {
          title: 'Surface: chat',
          body: prompt,
          metadata: ['Prompt stayed in the main chat surface.'],
          mode: 'route',
        }),
      })
    }

    await sendMessage(prompt)
  }

  const handleCommandBarSubmit = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      return
    }

    if (trimmed === '/clear') {
      logRuntimeEvent({
        ...withRuntimePreview({
          kind: 'command',
          status: 'success',
          title: 'Cleared chat transcript',
          detail: trimmed,
          panel: 'console',
          source: 'command-bar',
        }, {
          title: 'Command route: /clear',
          body: trimmed,
          metadata: ['Chat transcript cleared'],
          mode: 'runtime',
        }),
      })
      clearMessages()
      setActivePanel('console')
      return
    }

    if (trimmed.startsWith('/goto ')) {
      const target = trimmed.slice(6).trim().toLowerCase() as WorkspacePanel
      if (isWorkspacePanel(target)) {
        routePanel(target, `Command bar navigated via ${trimmed}.`, 'command-bar', trimmed)
        return
      }
    }

    if (trimmed.startsWith('/')) {
      const decision = detectCommandSurface(trimmed)
      if (decision) {
        routePanel(decision.panel, decision.reason, 'command-bar', trimmed)
      }
      logRuntimeEvent({
        ...withRuntimePreview({
          kind: 'command',
          status: 'info',
          title: 'Captured command runtime input',
          detail: `${trimmed}\nDedicated command execution is not wired for this command yet, so it has been captured in the in-window console.`,
          panel: decision?.panel || 'console',
          source: 'command-bar',
        }, {
          title: decision?.previewTitle || 'Command input captured',
          body: decision?.previewBody || trimmed,
          metadata: [decision?.reason || 'Dedicated command execution is not wired for this command yet.'],
          mode: 'runtime',
        }),
      })
      return
    }

    const contextualPrompt = activePanel === 'chat' || activePanel === 'tools' || activePanel === 'settings'
      ? trimmed
      : `[${activePanel}] ${trimmed}`

    await sendPromptToChat(contextualPrompt, 'command-bar')
  }

  const handleHeaderSearchSubmit = (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    if (trimmed.startsWith('/')) {
      void handleCommandBarSubmit(trimmed)
      return
    }

    requestSearch(trimmed, true)
    routePanel('search', `Header search opened the search surface for "${trimmed}".`, 'title-bar', trimmed)
  }

  const renderPanel = () => {
    if (activePanel === 'chat') {
      return <ChatWindow onSubmitMessage={(prompt) => sendPromptToChat(prompt, 'chat-window')} onArtifactCreated={handleArtifactCreated} onNavigate={(panel) => routePanel(panel, `Chat quick actions opened the ${panel} surface.`, 'chat-window')} />
    }

    if (activePanel === 'console') {
      return <ConsoleWorkspace onNavigate={(panel) => routePanel(panel, `Runtime inspector opened the ${panel} surface.`, 'console-workspace')} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'console-workspace')} onPreviewFocus={handleConsolePreviewFocus} />
    }

    if (activePanel === 'memory') {
      return <MemoryWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'memory-workspace')} onPreviewFocus={handleMemoryPreviewFocus} />
    }

    if (activePanel === 'tools') {
      return <ToolsWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'tools-workspace')} onRuntimeEvent={logRuntimeEvent} onArtifactCreated={handleArtifactCreated} />
    }

    if (activePanel === 'search') {
      return <SearchWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'search-workspace')} onRuntimeEvent={logRuntimeEvent} onArtifactCreated={handleArtifactCreated} />
    }

    if (activePanel === 'customize') {
      return <CustomizeWorkspace onPreviewFocus={handleCustomizePreviewFocus} />
    }

    if (activePanel === 'projects') {
      return (
        <FeatureWorkspace
          panel="business"
          title="Projects"
          summary="A workspace deck for office analysis, browser tasks, agent work, and operating multiple project surfaces from one desktop app."
          available={agents.business.available}
          enabled={agents.business.enabled}
          blockedReason={agents.business.blockedReason}
          prompts={[
            'Which names are the top movers in my portfolio and why?',
            'Turn these receipts into an expense report.',
            'Fix the auth bug in the signup flow.',
            'Create a shopping list, go on Chrome, and make an order.',
          ]}
          onUsePrompt={(prompt) => void sendPromptToChat(prompt)}
          onPreviewFocus={(focus) => handleFeaturePreviewFocus('projects', focus)}
        />
      )
    }

    if (activePanel === 'artifacts') {
      return <ArtifactsWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt)} onPreviewFocus={handleArtifactsPreviewFocus} />
    }

    if (activePanel === 'tasks') {
      return <TaskWorkspace onRuntimeEvent={logRuntimeEvent} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'task-workspace')} />
    }

    if (activePanel === 'computer') {
      return <ComputerViewWorkspace onRuntimeEvent={logRuntimeEvent} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'computer-workspace')} />
    }

    if (activePanel === 'browser') {
      return <BrowserWorkspace onRuntimeEvent={logRuntimeEvent} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'browser-workspace')} />
    }

    if (activePanel === 'dispatch') {
      return <DispatchWorkspace onRuntimeEvent={logRuntimeEvent} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'dispatch-workspace')} />
    }

    if (activePanel === 'coding') {
      return <CodingWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'coding-workspace')} onPreviewFocus={handleCodingPreviewFocus} />
    }

    if (activePanel === 'images') {
      return <MediaWorkspace onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'media-workspace')} onRuntimeEvent={logRuntimeEvent} onArtifactCreated={handleArtifactCreated} />
    }

    if (activePanel === 'settings') {
      return <SettingsPanel onPreviewFocus={handleSettingsPreviewFocus} />
    }

    if (activePanel === 'business') {
      return (
        <FeatureWorkspace
          panel="business"
          title="Business workspace"
          summary="Plan execution, write briefings, and turn commercial context into clear next actions from one surface."
          available={agents.business.available}
          enabled={agents.business.enabled}
          blockedReason={agents.business.blockedReason}
          prompts={[
            'Create a weekly execution plan for a small business operator.',
            'Summarize the risks and opportunities in a sales update.',
            'Turn rough notes into a clean client-facing business brief.',
            'Build a task list with owners, deadlines, and dependencies.',
          ]}
          onUsePrompt={(prompt) => void sendPromptToChat(prompt)}
          onPreviewFocus={(focus) => handleFeaturePreviewFocus('business', focus)}
        />
      )
    }

    if (activePanel === 'legal') {
      return (
        <FeatureWorkspace
          panel="legal"
          title="Legal workspace"
          summary="Keep the legal surface visible for contracts, clauses, and risk review even while deeper runtime tooling is still blocked."
          available={agents.legal.available}
          enabled={agents.legal.enabled}
          blockedReason={agents.legal.blockedReason}
          prompts={[
            'Review this agreement and list the highest-risk clauses.',
            'Summarize a contract in plain English for a non-lawyer.',
            'Identify missing protections in a services agreement.',
            'Turn legal notes into a negotiation checklist.',
          ]}
          onUsePrompt={(prompt) => void sendPromptToChat(prompt)}
          onPreviewFocus={(focus) => handleFeaturePreviewFocus('legal', focus)}
        />
      )
    }

    if (activePanel === 'accounting') {
      return (
        <FeatureWorkspace
          panel="accounting"
          title="Accounting workspace"
          summary="Hold a dedicated space for receipt review, budget summaries, and finance-oriented workflows."
          available={agents.accounting.available}
          enabled={agents.accounting.enabled}
          blockedReason={agents.accounting.blockedReason}
          prompts={[
            'Summarize this month\'s expenses by category.',
            'Turn raw numbers into a short cash-flow briefing.',
            'List missing details I should collect before sending to an accountant.',
            'Create a simple monthly finance review template.',
          ]}
          onUsePrompt={(prompt) => void sendPromptToChat(prompt)}
          onPreviewFocus={(focus) => handleFeaturePreviewFocus('accounting', focus)}
        />
      )
    }

    return (
      <FeatureWorkspace
        panel="reasoning"
        title="Reasoning workspace"
        summary="Keep a separate deep-analysis surface for structured breakdowns, scenario comparison, and long-form thinking."
        available={agents.reasoning.available}
        enabled={agents.reasoning.enabled}
        blockedReason={agents.reasoning.blockedReason}
        prompts={[
          'Compare three possible approaches and explain the tradeoffs clearly.',
          'Turn a messy problem into assumptions, options, risks, and next steps.',
          'Stress-test this plan and point out weak assumptions.',
          'Create a concise reasoning chain for a complex decision.',
        ]}
        onUsePrompt={(prompt) => void sendPromptToChat(prompt)}
        onPreviewFocus={(focus) => handleFeaturePreviewFocus('reasoning', focus)}
      />
    )
  }

  return (
    <div className={`flex h-screen flex-col text-claude-text font-inter ${fontSizeClass} ${shellClass} ${ui.compactMode ? 'tracking-tight' : ''}`}>
      <TitleBar
        activePanel={activePanel}
        providers={providers}
        activeProviderId={activeProviderId}
        selectedModel={models.defaultModel}
        onNavigate={(panel) => routePanel(panel, `Header controls opened the ${panel} surface.`, 'title-bar')}
        onProviderChange={setActiveProvider}
        onModelChange={(model) => setModelSetting('defaultModel', model)}
        onSearchSubmit={handleHeaderSearchSubmit}
        onCommandShortcut={(command) => void handleCommandBarSubmit(command)}
        onToggleSidebar={() => setUiSetting('showSidebar', !ui.showSidebar)}
        onToggleRightPanel={() => setUiSetting('showRightContextPanel', !ui.showRightContextPanel)}
        onBack={() => navigateHistory('back')}
        onForward={() => navigateHistory('forward')}
        canGoBack={panelHistoryIndex > 0}
        canGoForward={panelHistoryIndex < panelHistory.length - 1}
      />
      <CommandBar
        activePanel={activePanel}
        onNavigate={(panel) => routePanel(panel, `Command bar quick navigation opened the ${panel} surface.`, 'command-bar')}
        onSubmitCommand={handleCommandBarSubmit}
      />

      <div className={`flex flex-1 overflow-hidden ${layoutState.effectiveLayout === 'wide' ? '2xl:px-4' : ''}`}>
        <Sidebar
          open={ui.showSidebar}
          activePanel={activePanel}
          onPanelChange={(panel) => routePanel(panel, `Sidebar opened the ${panel} surface.`, 'sidebar')}
          onNewChat={handleCreateSession}
          onSelectSession={handleSelectSession}
          activeSessionId={activeSessionId}
          sessions={sessions}
          widthClass={layoutState.sidebarWidthClass}
        />

        <div className={contentContainerClass}>
          <div className={mainColumnClass}>
            <div className="flex-1 overflow-hidden">
              {renderPanel()}
            </div>
            {layoutState.showBottomConsole ? (
              <div className="h-[20rem] border-t border-claude-border bg-white">
                <ConsoleWorkspace embedded onNavigate={(panel) => routePanel(panel, `Embedded console opened the ${panel} surface.`, 'embedded-console')} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'embedded-console')} onPreviewFocus={handleEmbeddedConsolePreviewFocus} />
              </div>
            ) : null}
          </div>

          {layoutState.showSideConsole ? (
            <div className="hidden border-l border-claude-border bg-white xl:block">
              <ConsoleWorkspace embedded onNavigate={(panel) => routePanel(panel, `Side console opened the ${panel} surface.`, 'side-console')} onUsePrompt={(prompt) => void sendPromptToChat(prompt, 'side-console')} onPreviewFocus={handleSideConsolePreviewFocus} />
            </div>
          ) : null}
        </div>

        {layoutState.showRightPanel ? <RightContextPanel activePanel={activePanel} effectiveLayout={layoutState.effectiveLayout} widthClass={layoutState.rightPanelWidthClass} /> : null}
      </div>
    </div>
  )
}

export default App
