import { useEffect, useState } from 'react'
import type { RuntimeEventInput } from '../store/runtime'

type BrowserWorkspaceProps = {
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onUsePrompt: (prompt: string) => void
}

export function BrowserWorkspace({ onRuntimeEvent, onUsePrompt }: BrowserWorkspaceProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [sessionConfig, setSessionConfig] = useState<BrowserSessionConfig>({
    channel: 'chromium',
    persistentProfile: false,
    profileDirectory: '',
    extensionPaths: [],
  })
  const [extensionInput, setExtensionInput] = useState('')

  useEffect(() => {
    let disposed = false
    const hydrate = async () => {
      const config = await window.electronAPI.browserGetSessionConfig()
      if (!disposed) {
        setSessionConfig(config)
        setExtensionInput(config.extensionPaths.join('\n'))
      }
    }
    void hydrate()
    return () => {
      disposed = true
    }
  }, [])

  const handleOpen = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI.browserOpen()
      onRuntimeEvent({
        kind: 'tool',
        status: res.ok ? 'success' : 'error',
        title: 'Browser Open',
        detail: res.detail,
        panel: 'browser',
        source: 'browser-workspace',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI.browserClose()
      onRuntimeEvent({
        kind: 'tool',
        status: res.ok ? 'success' : 'error',
        title: 'Browser Close',
        detail: res.detail,
        panel: 'browser',
        source: 'browser-workspace',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = async () => {
    if (!url.trim()) return
    setLoading(true)
    try {
      const res = await window.electronAPI.browserNavigate(url.trim())
      onRuntimeEvent({
        kind: 'tool',
        status: res.ok ? 'success' : 'error',
        title: `Navigated to ${url.trim()}`,
        detail: res.detail,
        panel: 'browser',
        source: 'browser-workspace',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleScreenshot = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI.browserScreenshot()
      if (res.ok && res.data) {
        setScreenshot(res.data)
        onRuntimeEvent({
          kind: 'tool',
          status: 'success',
          title: 'Browser Screenshot',
          detail: 'Captured page screenshot via Playwright.',
          panel: 'browser',
          source: 'browser-workspace',
          preview: { title: 'Screenshot', body: 'Browser page screenshot', mode: 'browser' },
        })
      } else {
        onRuntimeEvent({
          kind: 'tool',
          status: 'error',
          title: 'Browser Screenshot',
          detail: res.detail,
          panel: 'browser',
          source: 'browser-workspace',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const saveSessionConfig = async () => {
    const config = await window.electronAPI.browserConfigureSession({
      ...sessionConfig,
      extensionPaths: extensionInput.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    })
    setSessionConfig(config)
    setExtensionInput(config.extensionPaths.join('\n'))
    onRuntimeEvent({
      kind: 'tool',
      status: 'success',
      title: 'Browser session updated',
      detail: `Channel: ${config.channel}\nPersistent profile: ${config.persistentProfile ? 'on' : 'off'}\nExtensions: ${config.extensionPaths.length}`,
      panel: 'browser',
      source: 'browser-workspace',
    })
  }

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {/* Header */}
        <div className="rounded-[28px] border border-claude-border bg-gradient-to-br from-[#1a2733] to-[#1e3a4a] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Browser Automation</div>
          <div className="mt-2 text-3xl font-semibold">Playwright-controlled browser</div>
          <div className="mt-2 max-w-3xl text-sm text-white/70">
            Full browser control: navigate, click, type, extract content, and take screenshots. Powered by Playwright with Chromium.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">Status: Live Mode</span>
            <button onClick={handleOpen} disabled={loading} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-white/20 active:scale-95 disabled:opacity-50">
              Open Browser
            </button>
            <button onClick={handleClose} disabled={loading} className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 shadow-sm transition hover:bg-red-500/30 active:scale-95 disabled:opacity-50">
              Close Browser
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {/* Navigation */}
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm transition-all">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Browser Controls</div>
            <div className="mt-2 text-sm text-claude-secondary">
              Playwright is loaded and ready. Ensure the browser is opened first before navigating or running extraction.
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleNavigate()}
                placeholder="example.com"
                className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none transition focus:border-claude-secondary"
              />
              <button
                onClick={() => void handleNavigate()}
                disabled={loading || !url.trim()}
                className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-black/80 active:scale-95 disabled:opacity-50"
              >
                Navigate
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => void handleScreenshot()} disabled={loading} className="rounded-full border border-claude-border bg-stone-50 px-3 py-1.5 text-xs font-semibold text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95 disabled:opacity-50">
                📸 Screenshot
              </button>
              <button onClick={async () => {
                const res = await window.electronAPI.browserExtractText()
                onRuntimeEvent({
                  kind: 'tool',
                  status: res.ok ? 'success' : 'error',
                  title: 'Extract Page Text',
                  detail: res.ok ? `Length: ${String(res.data).length} chars.\n\n${String(res.data).slice(0, 1000)}...` : res.detail,
                  panel: 'browser',
                  source: 'browser-workspace'
                })
              }} disabled={loading} className="rounded-full border border-claude-border bg-stone-50 px-3 py-1.5 text-xs font-semibold text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95 disabled:opacity-50">
                📋 Extract Text
              </button>
              <button onClick={async () => {
                const res = await window.electronAPI.browserListTabs()
                onRuntimeEvent({
                  kind: 'tool',
                  status: res.ok ? 'success' : 'error',
                  title: 'List Tabs',
                  detail: res.ok ? JSON.stringify(res.data, null, 2) : res.detail,
                  panel: 'browser',
                  source: 'browser-workspace'
                })
              }} disabled={loading} className="rounded-full border border-claude-border bg-stone-50 px-3 py-1.5 text-xs font-semibold text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95 disabled:opacity-50">
                📑 List Tabs
              </button>
            </div>
          </section>

          {/* Page Preview */}
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Page Preview</div>
              {screenshot && (
                <button
                  type="button"
                  onClick={() => onUsePrompt('Analyze this website screenshot and tell me what actions I can perform.')}
                  className="rounded-full border border-claude-border bg-stone-50 px-3 py-1 text-xs font-semibold text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Send to chat
                </button>
              )}
            </div>
            
            <div className="mt-4 flex min-h-[300px] items-center justify-center rounded-2xl border border-claude-border bg-stone-50 p-2 overflow-hidden">
              {screenshot ? (
                <img src={screenshot} alt="Browser screenshot" className="max-w-full max-h-[300px] rounded-xl object-contain" />
              ) : (
                <div className="text-center text-sm text-claude-secondary p-4">
                  <div className="text-4xl mb-3">🌐</div>
                  <div className="font-medium">No page captured</div>
                  <div className="mt-1">Click Screenshot to capture the current state of the Playwright window.</div>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Chrome Mode</div>
          <div className="mt-2 text-sm text-claude-secondary">
            Configure a persistent Chrome or Edge profile and load unpacked extensions. This is the foundation for Claude-for-Chrome style in-browser augmentation.
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.3fr_0.7fr]">
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">
                Browser channel
                <select value={sessionConfig.channel} onChange={(event) => setSessionConfig((current) => ({ ...current, channel: event.target.value as BrowserSessionConfig['channel'] }))} className="mt-2 w-full rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none">
                  <option value="chromium">Chromium</option>
                  <option value="chrome">Chrome</option>
                  <option value="msedge">Edge</option>
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-claude-border bg-stone-50 px-3 py-3 text-sm text-claude-text">
                <input type="checkbox" checked={sessionConfig.persistentProfile} onChange={(event) => setSessionConfig((current) => ({ ...current, persistentProfile: event.target.checked }))} />
                Use persistent profile
              </label>
              <input value={sessionConfig.profileDirectory} onChange={(event) => setSessionConfig((current) => ({ ...current, profileDirectory: event.target.value }))} placeholder="Profile directory" className="w-full rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
            </div>
            <div className="space-y-3">
              <textarea value={extensionInput} onChange={(event) => setExtensionInput(event.target.value)} placeholder="One unpacked extension directory per line" className="min-h-[130px] w-full rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
              <div className="rounded-2xl border border-claude-border bg-stone-50 p-3 text-xs text-claude-secondary">
                Bundled unpacked extension path in this repo: <span className="font-mono text-claude-text">browser-extension/dispatch-bridge-extension</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveSessionConfig()} className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-semibold text-white">Save Browser Mode</button>
                <button type="button" onClick={() => onUsePrompt('Open the configured browser session and inspect which extensions are available.') } className="rounded-2xl border border-claude-border px-4 py-2 text-sm font-semibold text-claude-text">Send to chat</button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { title: 'Page Navigation', desc: 'Navigate to any URL, control back/forward, control multiple tabs.' },
            { title: 'Content Extraction', desc: 'Extract visible text, tables, structured data from any page.' },
            { title: 'Page Interaction', desc: 'Click elements, fill forms, submit data, scroll pages.' },
            { title: 'Chrome Profiles', desc: 'Launch Chrome or Edge with a persistent user data directory.' },
            { title: 'Extension Loading', desc: 'Load unpacked extensions to support in-browser augmentation workflows.' },
            { title: 'Persistent Sessions', desc: 'Keep signed-in browser state and extension context across launches.' },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border border-claude-border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-claude-text">{card.title}</div>
              <div className="mt-1 text-xs text-claude-secondary">{card.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
