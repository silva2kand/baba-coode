import type { ReactNode } from 'react'
import { useChatStore } from '../store/chat'
import { useSettingsStore, type FeatureToggle, type ToggleSection } from '../store/settings'

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
            <div className="mt-2 text-[11px] font-medium text-amber-700">Blocked: {feature.blockedReason}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onToggle}
          disabled={!feature.available}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${feature.enabled ? 'bg-claude-text text-white' : 'border border-claude-border bg-white text-claude-text'} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {feature.enabled ? 'On' : 'Off'}
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
  onChange,
}: {
  label: string
  value: boolean
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
    </button>
  )
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

export function SettingsPanel() {
  const { providers, activeProviderId, setActiveProvider } = useChatStore()
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

  return (
    <section className="h-full overflow-auto bg-stone-50/70 p-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-3xl border border-claude-border bg-gradient-to-r from-white to-amber-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Settings Hub</div>
          <h2 className="mt-2 text-xl font-semibold text-claude-text">Everything controllable from one place</h2>
          <p className="mt-2 max-w-4xl text-sm text-claude-secondary">
            This settings hub covers AI models and routing, agents, data sources, tools, privacy and safety, layout, voice, and developer controls. If a feature is not wired yet, it is shown here as blocked instead of being silently omitted.
          </p>
        </div>

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
            <BooleanSelectRow label="Enable Ollama" value={models.enableOllama} onChange={(value) => setModelSetting('enableOllama', value)} />
            <BooleanSelectRow label="Enable Jan" value={models.enableJan} onChange={(value) => setModelSetting('enableJan', value)} />
            <BooleanSelectRow label="Enable LM Studio" value={models.enableLMStudio} onChange={(value) => setModelSetting('enableLMStudio', value)} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => (
              <div key={provider.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-claude-text">{provider.name}</div>
                  <div className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-claude-secondary">
                    {provider.active ? 'Active' : provider.available ? 'Ready' : 'Blocked'}
                  </div>
                </div>
                <div className="mt-2 text-xs text-claude-secondary">
                  Models: {provider.models.join(', ') || 'none'}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProvider(provider.id)}
                  disabled={!provider.available || activeProviderId === provider.id}
                  className="mt-3 rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {provider.active ? 'Selected' : 'Use provider'}
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Agents" description="Toggle every assistant domain surface from one place.">
          <ToggleGrid section="agents" definitions={agentDefinitions} values={agents as Record<string, FeatureToggle>} onToggle={toggleFeature} />
        </SectionCard>

        <SectionCard title="Data Sources" description="Control ingestion and observation sources for the command center.">
          <ToggleGrid section="dataSources" definitions={dataSourceDefinitions} values={dataSources as Record<string, FeatureToggle>} onToggle={toggleFeature} />
        </SectionCard>

        <SectionCard title="Tools" description="Enable or block research, file, shell, image, and voice tool families.">
          <ToggleGrid section="tools" definitions={toolDefinitions} values={tools as Record<string, FeatureToggle>} onToggle={toggleFeature} />
        </SectionCard>

        <SectionCard title="Privacy and Safety" description="Keep approval, privacy, and local-first behavior under explicit control.">
          <ToggleGrid section="privacy" definitions={privacyDefinitions} values={privacy as Record<string, FeatureToggle>} onToggle={toggleFeature} />
        </SectionCard>

        <SectionCard title="UI Layout" description="Control the main window layout directly from settings.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <BooleanSelectRow label="Show sidebar" value={ui.showSidebar} onChange={(value) => setUiSetting('showSidebar', value)} />
            <BooleanSelectRow label="Show right context panel" value={ui.showRightContextPanel} onChange={(value) => setUiSetting('showRightContextPanel', value)} />
            <BooleanSelectRow label="Compact mode" value={ui.compactMode} onChange={(value) => setUiSetting('compactMode', value)} />
            <SelectRow label="Theme" value={ui.theme} options={themeOptions} onChange={(value) => setUiSetting('theme', value as typeof ui.theme)} />
            <SelectRow label="Font size" value={ui.fontSize} options={fontOptions} onChange={(value) => setUiSetting('fontSize', value as typeof ui.fontSize)} />
            <SelectRow label="Layout preset" value={ui.layout} options={layoutOptions} onChange={(value) => setUiSetting('layout', value as typeof ui.layout)} />
          </div>
        </SectionCard>

        <SectionCard title="Voice" description="Voice behavior, selected voice, wake word, and microphone selection.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <BooleanSelectRow label="Enable voice" value={voice.enabled} onChange={(value) => setVoiceSetting('enabled', value)} />
            <BooleanSelectRow label="Enable wake word" value={voice.wakeWordEnabled} onChange={(value) => setVoiceSetting('wakeWordEnabled', value)} />
            <SelectRow label="Voice" value={voice.voice} options={voiceOptions} onChange={(value) => setVoiceSetting('voice', value)} />
            <SelectRow label="Wake word" value={voice.wakeWord} options={['Baba', 'Silva', 'Command Center']} onChange={(value) => setVoiceSetting('wakeWord', value)} />
            <SelectRow label="Microphone" value={voice.microphone} options={microphoneOptions} onChange={(value) => setVoiceSetting('microphone', value)} />
          </div>
        </SectionCard>

        <SectionCard title="Developer Mode" description="Advanced developer-facing controls and trace surfaces.">
          <ToggleGrid section="developer" definitions={developerDefinitions} values={developer as Record<string, FeatureToggle>} onToggle={toggleFeature} />
        </SectionCard>
      </div>
    </section>
  )
}
