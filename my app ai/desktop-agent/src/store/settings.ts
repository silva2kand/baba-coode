import { create } from 'zustand'

const STORAGE_KEY = 'silva-command-center-settings'

export type FeatureToggle = {
  enabled: boolean
  available: boolean
  blockedReason?: string
}

export type ThemeMode = 'sand' | 'light'
export type FontSizeMode = 'sm' | 'md' | 'lg'
export type LayoutMode = 'claude' | 'coding'
export type RoutingPreset = 'balanced-hybrid' | 'coding-first' | 'reasoning-first' | 'vision-first'

export type ModelRoutingSettings = {
  defaultModel: string
  codingModel: string
  reasoningModel: string
  visionModel: string
  fastModel: string
  routingPreset: RoutingPreset
  enableOllama: boolean
  enableJan: boolean
  enableLMStudio: boolean
}

export type AgentSettings = {
  business: FeatureToggle
  legal: FeatureToggle
  accounting: FeatureToggle
  coding: FeatureToggle
  content: FeatureToggle
  property: FeatureToggle
  generalPA: FeatureToggle
  reasoning: FeatureToggle
  imageVideoAnalysis: FeatureToggle
}

export type DataSourceSettings = {
  emailIngestion: FeatureToggle
  whatsappIngestion: FeatureToggle
  pdfDocumentIngestion: FeatureToggle
  screenshotAnalysis: FeatureToggle
  localFolderWatchers: FeatureToggle
}

export type ToolSettings = {
  webFetch: FeatureToggle
  fileTools: FeatureToggle
  shellTools: FeatureToggle
  browserResearch: FeatureToggle
  imageGeneration: FeatureToggle
  voiceInputOutput: FeatureToggle
}

export type PrivacySettings = {
  requireActionConfirmation: FeatureToggle
  disableExternalRequests: FeatureToggle
  disableWebFetch: FeatureToggle
  disableFileAccess: FeatureToggle
  localOnlyMode: FeatureToggle
}

export type UiSettings = {
  showSidebar: boolean
  showRightContextPanel: boolean
  theme: ThemeMode
  fontSize: FontSizeMode
  compactMode: boolean
  layout: LayoutMode
}

export type VoiceSettings = {
  enabled: boolean
  voice: string
  wakeWordEnabled: boolean
  wakeWord: string
  microphone: string
}

export type DeveloperSettings = {
  codingConsole: FeatureToggle
  toolLogs: FeatureToggle
  agentTraces: FeatureToggle
  advancedRoutingEditor: FeatureToggle
}

export type SettingsSnapshot = {
  models: ModelRoutingSettings
  agents: AgentSettings
  dataSources: DataSourceSettings
  tools: ToolSettings
  privacy: PrivacySettings
  ui: UiSettings
  voice: VoiceSettings
  developer: DeveloperSettings
}

export type ToggleSection = 'agents' | 'dataSources' | 'tools' | 'privacy' | 'developer'

type SettingsState = SettingsSnapshot & {
  hydrated: boolean
  hydrate: () => void
  toggleFeature: (section: ToggleSection, key: string) => void
  setModelSetting: <K extends keyof ModelRoutingSettings>(key: K, value: ModelRoutingSettings[K]) => void
  setUiSetting: <K extends keyof UiSettings>(key: K, value: UiSettings[K]) => void
  setVoiceSetting: <K extends keyof VoiceSettings>(key: K, value: VoiceSettings[K]) => void
}

const defaultSettings: SettingsSnapshot = {
  models: {
    defaultModel: 'Offline Assistant',
    codingModel: 'Qwen 2.5 Coder',
    reasoningModel: 'Gemini 2.5 Flash',
    visionModel: 'Gemini Vision',
    fastModel: 'Offline Assistant',
    routingPreset: 'balanced-hybrid',
    enableOllama: false,
    enableJan: false,
    enableLMStudio: false,
  },
  agents: {
    business: { enabled: true, available: true },
    legal: { enabled: false, available: true },
    accounting: { enabled: false, available: true },
    coding: { enabled: true, available: true },
    content: { enabled: false, available: false, blockedReason: 'Dedicated content-creation workflows are not implemented yet.' },
    property: { enabled: false, available: false, blockedReason: 'Dedicated property scouting workflows are not implemented yet.' },
    generalPA: { enabled: true, available: true },
    reasoning: { enabled: true, available: true },
    imageVideoAnalysis: { enabled: true, available: true },
  },
  dataSources: {
    emailIngestion: { enabled: false, available: false, blockedReason: 'Dedicated email ingestion is not implemented yet.' },
    whatsappIngestion: { enabled: false, available: false, blockedReason: 'Dedicated WhatsApp ingestion and export handling is not implemented yet.' },
    pdfDocumentIngestion: { enabled: false, available: false, blockedReason: 'Document ingestion and indexing are not implemented yet.' },
    screenshotAnalysis: { enabled: true, available: true },
    localFolderWatchers: { enabled: false, available: false, blockedReason: 'Local folder watcher services are not implemented yet.' },
  },
  tools: {
    webFetch: { enabled: true, available: true },
    fileTools: { enabled: true, available: true },
    shellTools: { enabled: true, available: true },
    browserResearch: { enabled: true, available: true },
    imageGeneration: { enabled: false, available: false, blockedReason: 'Requires image generation API (Phase 5).' },
    voiceInputOutput: { enabled: true, available: true },
  },
  privacy: {
    requireActionConfirmation: { enabled: true, available: true },
    disableExternalRequests: { enabled: false, available: true },
    disableWebFetch: { enabled: false, available: true },
    disableFileAccess: { enabled: false, available: true },
    localOnlyMode: { enabled: true, available: true },
  },
  ui: {
    showSidebar: true,
    showRightContextPanel: true,
    theme: 'sand',
    fontSize: 'md',
    compactMode: false,
    layout: 'claude',
  },
  voice: {
    enabled: false,
    voice: 'Warm Neutral',
    wakeWordEnabled: false,
    wakeWord: 'Baba',
    microphone: 'System Default',
  },
  developer: {
    codingConsole: { enabled: false, available: false, blockedReason: 'A dedicated coding console toggle is not wired separately yet.' },
    toolLogs: { enabled: false, available: false, blockedReason: 'Detailed tool trace toggles are not wired separately yet.' },
    agentTraces: { enabled: false, available: false, blockedReason: 'Detailed agent routing traces are not exposed separately yet.' },
    advancedRoutingEditor: { enabled: false, available: false, blockedReason: 'Advanced routing editor UI is not implemented yet.' },
  },
}

function cloneDefaults(): SettingsSnapshot {
  return JSON.parse(JSON.stringify(defaultSettings)) as SettingsSnapshot
}

function saveSnapshot(snapshot: SettingsSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function loadSnapshot(): SettingsSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return cloneDefaults()
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SettingsSnapshot>
    const defaults = cloneDefaults()
    const snapshot = {
      ...defaults,
      ...parsed,
      models: { ...defaults.models, ...parsed.models },
      agents: { ...defaults.agents, ...parsed.agents },
      dataSources: { ...defaults.dataSources, ...parsed.dataSources },
      tools: { ...defaults.tools, ...parsed.tools },
      privacy: { ...defaults.privacy, ...parsed.privacy },
      ui: { ...defaults.ui, ...parsed.ui },
      voice: { ...defaults.voice, ...parsed.voice },
      developer: { ...defaults.developer, ...parsed.developer },
    }

    const toolBridgeWasPreviouslyBlocked =
      snapshot.tools.webFetch.available === false &&
      snapshot.tools.fileTools.available === false &&
      snapshot.tools.browserResearch.available === false

    if (toolBridgeWasPreviouslyBlocked) {
      snapshot.tools.webFetch = defaults.tools.webFetch
      snapshot.tools.fileTools = defaults.tools.fileTools
      snapshot.tools.browserResearch = defaults.tools.browserResearch
      snapshot.agents.imageVideoAnalysis = defaults.agents.imageVideoAnalysis

      if (snapshot.privacy.disableExternalRequests.blockedReason === undefined) {
        snapshot.privacy.disableExternalRequests = defaults.privacy.disableExternalRequests
      }

      if (snapshot.privacy.disableWebFetch.blockedReason === undefined) {
        snapshot.privacy.disableWebFetch = defaults.privacy.disableWebFetch
      }
    }

    if (snapshot.agents.legal.available === false && snapshot.agents.legal.blockedReason === 'Requires task engine (Phase 3).') {
      snapshot.agents.legal = defaults.agents.legal
    }

    if (snapshot.agents.accounting.available === false && snapshot.agents.accounting.blockedReason === 'Requires task engine (Phase 3).') {
      snapshot.agents.accounting = defaults.agents.accounting
    }

    if (snapshot.dataSources.screenshotAnalysis.available === false && snapshot.dataSources.screenshotAnalysis.blockedReason === 'Requires computer control (Phase 1).') {
      snapshot.dataSources.screenshotAnalysis = defaults.dataSources.screenshotAnalysis
    }

    if (snapshot.agents.content.blockedReason === 'Requires task engine (Phase 3).') {
      snapshot.agents.content = defaults.agents.content
    }

    if (snapshot.agents.property.blockedReason === 'Requires task engine (Phase 3).') {
      snapshot.agents.property = defaults.agents.property
    }

    if (snapshot.dataSources.emailIngestion.blockedReason === 'Requires browser automation (Phase 2).') {
      snapshot.dataSources.emailIngestion = defaults.dataSources.emailIngestion
    }

    if (snapshot.dataSources.whatsappIngestion.blockedReason === 'Requires computer control (Phase 1) + browser automation (Phase 2).') {
      snapshot.dataSources.whatsappIngestion = defaults.dataSources.whatsappIngestion
    }

    if (snapshot.dataSources.pdfDocumentIngestion.blockedReason === 'Requires file watcher pipeline (Phase 5).') {
      snapshot.dataSources.pdfDocumentIngestion = defaults.dataSources.pdfDocumentIngestion
    }

    if (snapshot.dataSources.localFolderWatchers.blockedReason === 'Requires file watcher service (Phase 5).') {
      snapshot.dataSources.localFolderWatchers = defaults.dataSources.localFolderWatchers
    }

    if (snapshot.developer.codingConsole.blockedReason === 'Requires developer trace system (Phase 3).') {
      snapshot.developer.codingConsole = defaults.developer.codingConsole
    }

    if (snapshot.developer.toolLogs.blockedReason === 'Requires task engine traces (Phase 3).') {
      snapshot.developer.toolLogs = defaults.developer.toolLogs
    }

    if (snapshot.developer.agentTraces.blockedReason === 'Requires task engine traces (Phase 3).') {
      snapshot.developer.agentTraces = defaults.developer.agentTraces
    }

    if (snapshot.developer.advancedRoutingEditor.blockedReason === 'Requires plugin architecture (Phase 6).') {
      snapshot.developer.advancedRoutingEditor = defaults.developer.advancedRoutingEditor
    }

    return snapshot
  } catch {
    return cloneDefaults()
  }
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...cloneDefaults(),
  hydrated: false,
  hydrate: () => {
    const snapshot = loadSnapshot()
    set({ ...snapshot, hydrated: true })
  },
  toggleFeature: (section, key) => {
    set((state) => {
      const sectionState = state[section] as Record<string, FeatureToggle>
      const current = sectionState[key]
      if (!current || !current.available) {
        return state
      }

      const nextSection = {
        ...sectionState,
        [key]: {
          ...current,
          enabled: !current.enabled,
        },
      }

      const nextSnapshot: SettingsSnapshot = {
        models: state.models,
        agents: section === 'agents' ? (nextSection as AgentSettings) : state.agents,
        dataSources: section === 'dataSources' ? (nextSection as DataSourceSettings) : state.dataSources,
        tools: section === 'tools' ? (nextSection as ToolSettings) : state.tools,
        privacy: section === 'privacy' ? (nextSection as PrivacySettings) : state.privacy,
        ui: state.ui,
        voice: state.voice,
        developer: section === 'developer' ? (nextSection as DeveloperSettings) : state.developer,
      }
      saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  },
  setModelSetting: (key, value) => {
    set((state) => {
      const nextSnapshot: SettingsSnapshot = {
        models: { ...state.models, [key]: value },
        agents: state.agents,
        dataSources: state.dataSources,
        tools: state.tools,
        privacy: state.privacy,
        ui: state.ui,
        voice: state.voice,
        developer: state.developer,
      }
      saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  },
  setUiSetting: (key, value) => {
    set((state) => {
      const nextSnapshot: SettingsSnapshot = {
        models: state.models,
        agents: state.agents,
        dataSources: state.dataSources,
        tools: state.tools,
        privacy: state.privacy,
        ui: { ...state.ui, [key]: value },
        voice: state.voice,
        developer: state.developer,
      }
      saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  },
  setVoiceSetting: (key, value) => {
    set((state) => {
      const nextSnapshot: SettingsSnapshot = {
        models: state.models,
        agents: state.agents,
        dataSources: state.dataSources,
        tools: state.tools,
        privacy: state.privacy,
        ui: state.ui,
        voice: { ...state.voice, [key]: value },
        developer: state.developer,
      }
      saveSnapshot(nextSnapshot)
      return nextSnapshot
    })
  },
}))