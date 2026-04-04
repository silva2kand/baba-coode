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

const unavailableReason = 'Feature is listed in settings, but runtime wiring is still scaffolded in this build.'

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
    legal: { enabled: false, available: false, blockedReason: unavailableReason },
    accounting: { enabled: false, available: false, blockedReason: unavailableReason },
    coding: { enabled: true, available: true },
    content: { enabled: false, available: false, blockedReason: unavailableReason },
    property: { enabled: false, available: false, blockedReason: unavailableReason },
    generalPA: { enabled: true, available: true },
    reasoning: { enabled: true, available: true },
    imageVideoAnalysis: { enabled: false, available: false, blockedReason: unavailableReason },
  },
  dataSources: {
    emailIngestion: { enabled: false, available: false, blockedReason: unavailableReason },
    whatsappIngestion: { enabled: false, available: false, blockedReason: unavailableReason },
    pdfDocumentIngestion: { enabled: false, available: false, blockedReason: unavailableReason },
    screenshotAnalysis: { enabled: false, available: false, blockedReason: unavailableReason },
    localFolderWatchers: { enabled: false, available: false, blockedReason: unavailableReason },
  },
  tools: {
    webFetch: { enabled: false, available: false, blockedReason: unavailableReason },
    fileTools: { enabled: false, available: false, blockedReason: unavailableReason },
    shellTools: { enabled: false, available: false, blockedReason: unavailableReason },
    browserResearch: { enabled: false, available: false, blockedReason: unavailableReason },
    imageGeneration: { enabled: false, available: false, blockedReason: unavailableReason },
    voiceInputOutput: { enabled: false, available: false, blockedReason: unavailableReason },
  },
  privacy: {
    requireActionConfirmation: { enabled: true, available: true },
    disableExternalRequests: { enabled: true, available: true },
    disableWebFetch: { enabled: true, available: true },
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
    codingConsole: { enabled: false, available: false, blockedReason: unavailableReason },
    toolLogs: { enabled: false, available: false, blockedReason: unavailableReason },
    agentTraces: { enabled: false, available: false, blockedReason: unavailableReason },
    advancedRoutingEditor: { enabled: false, available: false, blockedReason: unavailableReason },
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
    return {
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