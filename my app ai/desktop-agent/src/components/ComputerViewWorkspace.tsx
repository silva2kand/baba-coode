import { useState } from 'react'
import type { RuntimeEventInput } from '../store/runtime'

type ComputerViewWorkspaceProps = {
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onUsePrompt: (prompt: string) => void
}

export function ComputerViewWorkspace({ onRuntimeEvent, onUsePrompt }: ComputerViewWorkspaceProps) {
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [screenshotMeta, setScreenshotMeta] = useState<{ width: number; height: number; timestamp: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [appPath, setAppPath] = useState('')
  const [launchResult, setLaunchResult] = useState('')

  const captureScreenshot = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.computerScreenshot()
      if (result.dataUrl) {
        setScreenshot(result.dataUrl)
        setScreenshotMeta({ width: result.width, height: result.height, timestamp: result.timestamp })
        onRuntimeEvent({
          kind: 'tool',
          status: 'success',
          title: 'Captured screenshot',
          detail: `${result.width}×${result.height} at ${new Date(result.timestamp).toLocaleTimeString()}`,
          panel: 'computer',
          source: 'computer-workspace',
          preview: { title: 'Screenshot captured', body: `${result.width}×${result.height}`, mode: 'computer' },
        })
      } else {
        onRuntimeEvent({
          kind: 'tool',
          status: 'error',
          title: 'Screenshot failed',
          detail: 'No screen data returned from desktopCapturer.',
          panel: 'computer',
          source: 'computer-workspace',
        })
      }
    } catch (err) {
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'Screenshot error',
        detail: err instanceof Error ? err.message : 'Unknown error',
        panel: 'computer',
        source: 'computer-workspace',
      })
    } finally {
      setLoading(false)
    }
  }

  const launchApp = async () => {
    const trimmed = appPath.trim()
    if (!trimmed) return
    try {
      const result = await window.electronAPI.computerLaunchApp(trimmed)
      setLaunchResult(result.detail)
      onRuntimeEvent({
        kind: 'command',
        status: result.ok ? 'success' : 'error',
        title: result.ok ? `Launched ${trimmed}` : `Failed to launch ${trimmed}`,
        detail: result.detail,
        panel: 'computer',
        source: 'computer-workspace',
      })
    } catch (err) {
      setLaunchResult(err instanceof Error ? err.message : 'Launch failed')
    }
  }

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {/* Header */}
        <div className="rounded-[28px] border border-claude-border bg-gradient-to-br from-[#1a1d28] to-[#2a2d3a] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Computer Control</div>
          <div className="mt-2 text-3xl font-semibold">Full desktop control from one surface</div>
          <div className="mt-2 max-w-3xl text-sm text-white/70">
            Screen capture, mouse control, keyboard control, scrolling, and app launching are live through Electron IPC and Nut.js.
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">Screenshot: Live</span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">Mouse: Live</span>
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">Keyboard: Live</span>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          {/* Screenshot Panel */}
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Screen Capture</div>
                <div className="mt-1 text-sm text-claude-secondary">Capture the current screen and analyze it.</div>
              </div>
              <button
                type="button"
                onClick={() => void captureScreenshot()}
                disabled={loading}
                className="rounded-full bg-claude-text px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Capturing...' : 'Capture'}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-2 min-h-[300px] flex items-center justify-center">
              {screenshot ? (
                <img src={screenshot} alt="Desktop screenshot" className="max-w-full rounded-xl" />
              ) : (
                <div className="text-sm text-claude-secondary">Click Capture to take a screenshot of your desktop.</div>
              )}
            </div>

            {screenshotMeta ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-xs text-claude-secondary">{screenshotMeta.width}×{screenshotMeta.height}</span>
                <span className="text-xs text-claude-secondary">·</span>
                <span className="text-xs text-claude-secondary">{new Date(screenshotMeta.timestamp).toLocaleTimeString()}</span>
                <button
                  type="button"
                  onClick={() => onUsePrompt(`Analyze this screenshot and describe what you see on screen. The screenshot is ${screenshotMeta.width}×${screenshotMeta.height}.`)}
                  className="rounded-full border border-claude-border px-3 py-1 text-xs font-medium text-claude-text"
                >
                  Send to chat
                </button>
              </div>
            ) : null}
          </section>

          {/* App Launcher + Controls */}
          <section className="flex flex-col gap-5">
            <div className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">App Launcher</div>
              <div className="mt-1 text-sm text-claude-secondary">Open any application by path.</div>
              <div className="mt-3 flex gap-2">
                <input
                  value={appPath}
                  onChange={(e) => setAppPath(e.target.value)}
                  placeholder="C:\Windows\notepad.exe"
                  className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => void launchApp()}
                  className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white"
                >
                  Launch
                </button>
              </div>
              {launchResult ? <div className="mt-2 text-xs text-claude-secondary">{launchResult}</div> : null}

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Notepad', path: 'notepad.exe' },
                  { label: 'Calculator', path: 'calc.exe' },
                  { label: 'File Explorer', path: 'explorer.exe' },
                  { label: 'Task Manager', path: 'taskmgr.exe' },
                ].map((app) => (
                  <button
                    key={app.path}
                    type="button"
                    onClick={() => { setAppPath(app.path); void window.electronAPI.computerLaunchApp(app.path) }}
                    className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-left text-sm text-claude-text transition hover:bg-white"
                  >
                    {app.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Placeholder for mouse/keyboard */}
            <div className="rounded-3xl border border-dashed border-claude-border bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Input Control</div>
              <div className="mt-2 text-sm text-claude-secondary">
                Nut.js is now active. You can test basic computer controls below.
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => void window.electronAPI.computerMouse({ action: 'move', x: 500, y: 500 })}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Mouse Move (500,500)
                </button>
                <button
                  type="button"
                  onClick={() => void window.electronAPI.computerMouse({ action: 'click', x: 0, y: 0 })}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Click Here
                </button>
                <button
                  type="button"
                  onClick={() => void window.electronAPI.computerKeyboard({ action: 'type', text: 'Hello from SILVA! ' })}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Type Text
                </button>
                <button
                  type="button"
                  onClick={() => void window.electronAPI.computerKeyboard({ action: 'hotkey', key: 'r', modifiers: ['windows'] })}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Win + R
                </button>
                <button
                  type="button"
                  onClick={() => void window.electronAPI.computerMouse({ action: 'scroll', x: 0, y: 0, scrollAmount: -100 })}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  Scroll Down
                </button>
                <button
                  type="button"
                  onClick={async () => {
                     const wins = await window.electronAPI.computerWindowList()
                     onRuntimeEvent({
                       kind: 'tool',
                       status: 'success',
                       title: 'Window List',
                       detail: `Found ${wins.length} active windows.\n${wins.map((w: any) => w.title).join('\n')}`,
                       panel: 'computer',
                       source: 'computer-workspace'
                     })
                  }}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-xs font-medium text-claude-text shadow-sm transition hover:bg-stone-100 active:scale-95"
                >
                  List Windows
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
