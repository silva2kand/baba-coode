import { useEffect, useState, type ReactNode } from 'react'
import { useChatStore } from '../store/chat'
import { useSettingsStore, type FeatureToggle, type ToggleSection } from '../store/settings'
import type { PreviewFocusMode } from '../types/workspace'

type SettingsPanelProps = {
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

type SettingsState = ReturnType<typeof useSettingsStore.getState>

type ToggleKeyMap = {
  agents: keyof SettingsState['agents']
  dataSources: keyof SettingsState['dataSources']
  tools: keyof SettingsState['tools']
  privacy: keyof SettingsState['privacy']
  developer: keyof SettingsState['developer']
}

type ToggleDefinition<S extends ToggleSection> = {
  key: ToggleKeyMap[S]
  title: string
  description: string
}

type ProfileForm = {
  fullName: string
  preferredName: string
  role: string
  preferences: string
}

const PROFILE_STORAGE_KEY = 'silva-command-center-profile'

function loadProfile(): ProfileForm {
  const defaults: ProfileForm = {
    fullName: '',
    preferredName: '',
    role: 'Software engineering',
    preferences: 'I primarily code in Python and TypeScript, and prefer direct, concise responses.',
  }

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!raw) {
      return defaults
    }
    const parsed = JSON.parse(raw) as Partial<ProfileForm>
    return {
      fullName: parsed.fullName ?? defaults.fullName,
      preferredName: parsed.preferredName ?? defaults.preferredName,
      role: parsed.role ?? defaults.role,
      preferences: parsed.preferences ?? defaults.preferences,
    }
  } catch {
    return defaults
  }
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-claude-text">{title}</h3>
        <p className="mt-1 text-sm text-claude-secondary">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ToggleRow({
  title,
  description,
  feature,
  onToggle,
}: {
  title: string
  description: string
  feature: FeatureToggle
  onToggle: () => void
}) {
  return (
    <div className="rounded-2xl border border-claude-border bg-stone-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-claude-text">{title}</div>
          <div className="mt-1 text-xs text-claude-secondary">{description}</div>
          {!feature.available && feature.blockedReason ? (
            <div className="mt-2 text-[11px] font-medium text-amber-700">Planned: {feature.blockedReason}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={!feature.available}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${feature.enabled ? 'bg-claude-text text-white' : 'border border-claude-border bg-white text-claude-text'} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {!feature.available ? 'Planned' : feature.enabled ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-2 rounded-2xl border border-claude-border bg-stone-50 p-4 text-sm text-claude-text">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-claude-border bg-white px-3 py-2 text-sm outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function BooleanSelectRow({
  label,
  value,
  description,
  onChange,
}: {
  label: string
  value: boolean
  description?: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${value ? 'border-claude-text bg-claude-text text-white' : 'border-claude-border bg-stone-50 text-claude-text'}`}
    >
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-xs opacity-70">{value ? 'Enabled' : 'Disabled'}</div>
      {description ? <div className="mt-2 text-[11px] opacity-70">{description}</div> : null}
    </button>
  )
}

function getProviderStatusLabel(provider: { active: boolean; available: boolean; kind: 'local' | 'remote' | 'offline' }) {
  if (provider.active) {
    return 'Active'
  }
  if (provider.available) {
    return 'Ready'
  }
  if (provider.kind === 'local') {
    return 'Offline'
  }
  return 'Scaffolded'
}

function ToggleGrid<S extends ToggleSection>({
  section,
  definitions,
  values,
  onToggle,
}: {
  section: S
  definitions: ToggleDefinition<S>[]
  values: Record<string, FeatureToggle>
  onToggle: (section: ToggleSection, key: string) => void
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {definitions.map((definition) => (
        <ToggleRow
          key={String(definition.key)}
          title={definition.title}
          description={definition.description}
          feature={values[String(definition.key)]}
          onToggle={() => onToggle(section, String(definition.key))}
        />
      ))}
    </div>
  )
}

export function SettingsPanel({ onPreviewFocus }: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState('general')
  const [profile, setProfile] = useState<ProfileForm>(() => loadProfile())
  const [providerProbeLoading, setProviderProbeLoading] = useState(false)
  const { providers, activeProviderId, setActiveProvider, probeProviders } = useChatStore()
  const {
    models,
    agents,
    dataSources,
    tools,
    privacy,
    ui,
    voice,
    developer,
    toggleFeature,
    setModelSetting,
    setUiSetting,
    setVoiceSetting,
  } = useSettingsStore()

  const modelOptions = [
    'Offline Assistant',
    'Qwen 2.5 Coder',
    'Gemini 2.5 Flash',
    'Gemini Vision',
    'Ollama Local',
    'LM Studio Local',
    'Jan Local',
    'OpenRouter Auto',
  ]

  const routingOptions = ['balanced-hybrid', 'coding-first', 'reasoning-first', 'vision-first']
  const themeOptions = ['sand', 'light']
  const fontOptions = ['sm', 'md', 'lg']
  const layoutOptions = ['claude', 'coding']
  const voiceOptions = ['Warm Neutral', 'Calm Analyst', 'Bright Assistant']
  const microphoneOptions = ['System Default', 'Studio Mic', 'Headset Mic']
  const primaryCategories = [
    { key: 'general', label: 'General' },
    { key: 'models', label: 'Models' },
    { key: 'capabilities', label: 'Capabilities' },
    { key: 'privacy', label: 'Privacy' },
    { key: 'voice', label: 'Voice' },
    { key: 'developer', label: 'Developer' },
  ]

  const agentDefinitions: ToggleDefinition<'agents'>[] = [
    { key: 'business', title: 'Business agent', description: 'Business intelligence, organisation, and planning workflows.' },
    { key: 'legal', title: 'Legal agent', description: 'Solicitor-style analysis workspace for contracts and legal notes.' },
    { key: 'accounting', title: 'Accounting agent', description: 'Accounting summaries, receipts, and finance review.' },
    { key: 'coding', title: 'Coding agent', description: 'Code analysis, implementation planning, and development support.' },
    { key: 'content', title: 'Content creator', description: 'Content drafting, rewriting, and marketing support.' },
    { key: 'property', title: 'Property and deal scout', description: 'Property research and deal analysis flows.' },
    { key: 'generalPA', title: 'General PA', description: 'General personal assistant coordination and reminders.' },
    { key: 'reasoning', title: 'Reasoning sandbox', description: 'Structured reasoning and deep analysis mode.' },
    { key: 'imageVideoAnalysis', title: 'Image and video analysis', description: 'Multimodal analysis for screenshots, images, and video.' },
  ]

  const dataSourceDefinitions: ToggleDefinition<'dataSources'>[] = [
    { key: 'emailIngestion', title: 'Email ingestion', description: 'Read and summarize incoming email sources.' },
    { key: 'whatsappIngestion', title: 'WhatsApp ingestion', description: 'Load WhatsApp exports into the workspace.' },
    { key: 'pdfDocumentIngestion', title: 'PDF and document ingestion', description: 'Drag in PDFs, contracts, and documents.' },
    { key: 'screenshotAnalysis', title: 'Screenshot analysis', description: 'Turn screenshots into structured multimodal context.' },
    { key: 'localFolderWatchers', title: 'Local folder watchers', description: 'Watch folders such as bills, contracts, and receipts.' },
  ]

  const toolDefinitions: ToggleDefinition<'tools'>[] = [
    { key: 'webFetch', title: 'Web fetch', description: 'Safe URL fetch and summarization pipeline.' },
    { key: 'fileTools', title: 'File tools', description: 'Read and inspect local files through the command center.' },
    { key: 'shellTools', title: 'Shell tools', description: 'Controlled terminal-oriented assistant actions.' },
    { key: 'browserResearch', title: 'Browser-style research', description: 'Research workflows through safe machine-side fetching.' },
    { key: 'imageGeneration', title: 'Image generation', description: 'Image creation and generation workflows.' },
    { key: 'voiceInputOutput', title: 'Voice input and output', description: 'Microphone and speech output integration.' },
  ]

  const privacyDefinitions: ToggleDefinition<'privacy'>[] = [
    { key: 'requireActionConfirmation', title: 'Require confirmation before actions', description: 'Keep approval in the loop for any action-oriented workflow.' },
    { key: 'disableExternalRequests', title: 'Disable external requests', description: 'Block outbound network requests for strict privacy.' },
    { key: 'disableWebFetch', title: 'Disable web fetch', description: 'Force the app to stay away from URL fetch tools.' },
    { key: 'disableFileAccess', title: 'Disable file access', description: 'Lock file access down when needed.' },
    { key: 'localOnlyMode', title: 'Local-only mode', description: 'Prefer local workflows and avoid external services by default.' },
  ]

  const developerDefinitions: ToggleDefinition<'developer'>[] = [
    { key: 'codingConsole', title: 'Coding console', description: 'Developer-focused command console for coding workflows.' },
    { key: 'toolLogs', title: 'Tool logs', description: 'Show tool execution logs and traces.' },
    { key: 'agentTraces', title: 'Agent traces', description: 'Expose internal agent routing and decision traces.' },
    { key: 'advancedRoutingEditor', title: 'Advanced routing editor', description: 'Edit advanced model routing and orchestration behavior.' },
  ]

  useEffect(() => {
    const activeProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers.find((provider) => provider.active) ?? null
    const enabledAgentCount = Object.values(agents).filter((feature) => feature.enabled).length
    const enabledToolCount = Object.values(tools).filter((feature) => feature.enabled).length

    onPreviewFocus({
      title: `Settings · ${activeCategory}`,
      body: `Active provider: ${activeProvider?.name || 'none'}\nRouting preset: ${models.routingPreset}\nTheme: ${ui.theme}\nLayout: ${ui.layout}`,
      metadata: [`${enabledAgentCount} agents enabled`, `${enabledToolCount} tools enabled`, `Right panel ${ui.showRightContextPanel ? 'on' : 'off'}`],
      mode: 'route',
    })
  }, [activeCategory, activeProviderId, agents, models.routingPreset, onPreviewFocus, providers, tools, ui.layout, ui.showRightContextPanel, ui.theme])

  useEffect(() => {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }, [profile])

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-5">
      <div className="mx-auto grid max-w-7xl gap-4 rounded-[28px] border border-claude-border bg-white shadow-sm lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-claude-border p-5">
          <div className="text-4xl font-semibold text-claude-text">Settings</div>
          <div className="mt-6 space-y-1">
            {primaryCategories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm transition ${activeCategory === category.key ? 'bg-[#f1ede3] font-semibold text-claude-text' : 'text-claude-secondary hover:bg-stone-50'}`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="p-6">
          <div className="grid gap-5">
            {activeCategory === 'general' ? (
              <>
                <SectionCard title="Profile" description="Account and persona details for the desktop app experience.">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm text-claude-text">
                      <span className="font-medium">Full name</span>
                      <input
                        value={profile.fullName}
                        onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))}
                        placeholder="Your full name"
                        className="rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-claude-text">
                      <span className="font-medium">What should the app call you?</span>
                      <input
                        value={profile.preferredName}
                        onChange={(event) => setProfile((current) => ({ ...current, preferredName: event.target.value }))}
                        placeholder="Preferred name"
                        className="rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-claude-text">
                      <span className="font-medium">What best describes your work?</span>
                      <select
                        value={profile.role}
                        onChange={(event) => setProfile((current) => ({ ...current, role: event.target.value }))}
                        className="rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option>Software engineering</option>
                        <option>Product and strategy</option>
                        <option>Research and analysis</option>
                        <option>Operations and admin</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm text-claude-text lg:col-span-2">
                      <span className="font-medium">Personal preferences</span>
                      <textarea
                        value={profile.preferences}
                        onChange={(event) => setProfile((current) => ({ ...current, preferences: event.target.value }))}
                        className="min-h-[110px] rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm outline-none"
                      />
                    </label>
                  </div>
                </SectionCard>

                <SectionCard title="Appearance" description="Configure the desktop shell layout and readability.">
                  <div className="grid gap-4 xl:grid-cols-3">
                    <SelectRow label="Theme" value={ui.theme} options={themeOptions} onChange={(value) => setUiSetting('theme', value as typeof ui.theme)} />
                    <SelectRow label="Font size" value={ui.fontSize} options={fontOptions} onChange={(value) => setUiSetting('fontSize', value as typeof ui.fontSize)} />
                    <SelectRow label="Layout preset" value={ui.layout} options={layoutOptions} onChange={(value) => setUiSetting('layout', value as typeof ui.layout)} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <BooleanSelectRow label="Show sidebar" value={ui.showSidebar} onChange={(value) => setUiSetting('showSidebar', value)} />
                    <BooleanSelectRow label="Show right context panel" value={ui.showRightContextPanel} onChange={(value) => setUiSetting('showRightContextPanel', value)} />
                    <BooleanSelectRow label="Compact mode" value={ui.compactMode} onChange={(value) => setUiSetting('compactMode', value)} />
                  </div>

                  <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-claude-text">Desktop shortcuts and input behavior</div>
                    <div className="mt-2 text-xs text-claude-secondary">
                      Global show/hide window: Ctrl+Shift+Space (Windows/Linux) or Cmd+Shift+Space (macOS).
                    </div>
                    <div className="mt-1 text-xs text-claude-secondary">
                      Header Search runs URL/query research in the Search workspace.
                    </div>
                    <div className="mt-1 text-xs text-claude-secondary">
                      Command bar Send posts a prompt. Run executes slash commands.
                    </div>
                  </div>
                </SectionCard>
              </>
            ) : null}

            {activeCategory === 'models' ? (
              <SectionCard
                title="AI Models and Routing"
                description="Default model picks, specialist routing, local provider toggles, and active provider selection."
              >
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <SelectRow label="Default model" value={models.defaultModel} options={modelOptions} onChange={(value) => setModelSetting('defaultModel', value)} />
                  <SelectRow label="Coding model" value={models.codingModel} options={modelOptions} onChange={(value) => setModelSetting('codingModel', value)} />
                  <SelectRow label="Reasoning model" value={models.reasoningModel} options={modelOptions} onChange={(value) => setModelSetting('reasoningModel', value)} />
                  <SelectRow label="Vision model" value={models.visionModel} options={modelOptions} onChange={(value) => setModelSetting('visionModel', value)} />
                  <SelectRow label="Small / fast model" value={models.fastModel} options={modelOptions} onChange={(value) => setModelSetting('fastModel', value)} />
                  <SelectRow label="Routing preset" value={models.routingPreset} options={routingOptions} onChange={(value) => setModelSetting('routingPreset', value as typeof models.routingPreset)} />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <BooleanSelectRow label="Prefer Ollama" value={models.enableOllama} description="Saved routing preference only. Live provider status is shown below." onChange={(value) => setModelSetting('enableOllama', value)} />
                  <BooleanSelectRow label="Prefer Jan" value={models.enableJan} description="Saved routing preference only. Live provider status is shown below." onChange={(value) => setModelSetting('enableJan', value)} />
                  <BooleanSelectRow label="Prefer LM Studio" value={models.enableLMStudio} description="Saved routing preference only. Live provider status is shown below." onChange={(value) => setModelSetting('enableLMStudio', value)} />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-claude-border bg-stone-50 px-4 py-3">
                  <div className="text-xs text-claude-secondary">
                    If a local provider changed state, run a fresh localhost probe.
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setProviderProbeLoading(true)
                      try {
                        await probeProviders()
                      } finally {
                        setProviderProbeLoading(false)
                      }
                    }}
                    disabled={providerProbeLoading}
                    className="rounded-full border border-claude-border bg-white px-3 py-1.5 text-xs font-semibold text-claude-text disabled:opacity-50"
                  >
                    {providerProbeLoading ? 'Scanning...' : 'Re-scan local providers'}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {providers.map((provider) => (
                    <div key={provider.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-claude-text">{provider.name}</div>
                        <div className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-claude-secondary">
                          {getProviderStatusLabel(provider)}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-claude-secondary">
                        Models: {provider.models.join(', ') || 'none'}
                      </div>
                      <div className="mt-2 text-xs text-claude-secondary">
                        {provider.detail}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveProvider(provider.id)}
                        disabled={!provider.available || activeProviderId === provider.id}
                        className="mt-3 rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {provider.active ? 'Selected' : provider.available ? 'Use provider' : provider.kind === 'local' ? 'Offline' : 'Not configured'}
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {activeCategory === 'capabilities' ? (
              <>
                <SectionCard title="Agents" description="Toggle every assistant domain surface from one place.">
                  <ToggleGrid section="agents" definitions={agentDefinitions} values={agents as Record<string, FeatureToggle>} onToggle={toggleFeature} />
                </SectionCard>

                <SectionCard title="Data Sources" description="Control ingestion and observation sources for the command center.">
                  <ToggleGrid section="dataSources" definitions={dataSourceDefinitions} values={dataSources as Record<string, FeatureToggle>} onToggle={toggleFeature} />
                </SectionCard>

                <SectionCard title="Tools" description="Enable or block research, file, shell, image, and voice tool families.">
                  <ToggleGrid section="tools" definitions={toolDefinitions} values={tools as Record<string, FeatureToggle>} onToggle={toggleFeature} />
                </SectionCard>
              </>
            ) : null}

            {activeCategory === 'privacy' ? (
              <SectionCard title="Privacy and Safety" description="Keep approval, privacy, and local-first behavior under explicit control.">
                <ToggleGrid section="privacy" definitions={privacyDefinitions} values={privacy as Record<string, FeatureToggle>} onToggle={toggleFeature} />
              </SectionCard>
            ) : null}

            {activeCategory === 'voice' ? (
              <SectionCard title="Voice" description="Voice behavior, selected voice, wake word, and microphone selection.">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <BooleanSelectRow label="Enable voice" value={voice.enabled} onChange={(value) => setVoiceSetting('enabled', value)} />
                  <BooleanSelectRow label="Enable wake word" value={voice.wakeWordEnabled} onChange={(value) => setVoiceSetting('wakeWordEnabled', value)} />
                  <SelectRow label="Voice" value={voice.voice} options={voiceOptions} onChange={(value) => setVoiceSetting('voice', value)} />
                  <SelectRow label="Wake word" value={voice.wakeWord} options={['Baba', 'Silva', 'Command Center']} onChange={(value) => setVoiceSetting('wakeWord', value)} />
                  <SelectRow label="Microphone" value={voice.microphone} options={microphoneOptions} onChange={(value) => setVoiceSetting('microphone', value)} />
                </div>
              </SectionCard>
            ) : null}

            {activeCategory === 'developer' ? (
              <SectionCard title="Developer Mode" description="Advanced developer-facing controls and trace surfaces.">
                <ToggleGrid section="developer" definitions={developerDefinitions} values={developer as Record<string, FeatureToggle>} onToggle={toggleFeature} />
              </SectionCard>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
