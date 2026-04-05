import { useEffect, useMemo, useState } from 'react'
import type { PreviewFocusMode } from '../types/workspace'

type ConnectorRecord = Record<string, { connected: boolean; updatedAt: number }>

type ConnectorItem = {
  id: string
  name: string
  summary: string
  webUrl?: string
  desktopLaunch?: string
}

const CONNECTOR_STORAGE_KEY = 'silva-connectors-state'

const connectorItems: ConnectorItem[] = [
  { id: 'browser', name: 'Browser (Chrome/Edge)', summary: 'Open browser apps and run research/automation flows.', webUrl: 'https://www.google.com', desktopLaunch: 'chrome.exe' },
  { id: 'whatsapp', name: 'WhatsApp', summary: 'Open WhatsApp Web or launch desktop WhatsApp client.', webUrl: 'https://web.whatsapp.com', desktopLaunch: 'WhatsApp.exe' },
  { id: 'outlook', name: 'Outlook', summary: 'Open Outlook Web and optionally launch desktop Outlook.', webUrl: 'https://outlook.office.com/mail', desktopLaunch: 'outlook.exe' },
  { id: 'tiktok', name: 'TikTok', summary: 'Open TikTok for content review workflows.', webUrl: 'https://www.tiktok.com' },
  { id: 'instagram', name: 'Instagram', summary: 'Open Instagram for social workflows.', webUrl: 'https://www.instagram.com' },
  { id: 'facebook', name: 'Facebook', summary: 'Open Facebook pages, groups, and messages.', webUrl: 'https://www.facebook.com' },
  { id: 'linkedin', name: 'LinkedIn', summary: 'Open LinkedIn profiles, posts, and messaging.', webUrl: 'https://www.linkedin.com' },
  { id: 'phonelink', name: 'Phone Link', summary: 'Launch Windows Phone Link app for mobile-to-desktop context.', desktopLaunch: 'PhoneExperienceHost.exe' },
  { id: 'gdrive', name: 'Google Drive', summary: 'Open cloud files in Google Drive.', webUrl: 'https://drive.google.com' },
  { id: 'onedrive', name: 'OneDrive', summary: 'Open cloud files in OneDrive.', webUrl: 'https://onedrive.live.com' },
  { id: 'dropbox', name: 'Dropbox', summary: 'Open cloud files in Dropbox.', webUrl: 'https://www.dropbox.com/home' },
  { id: 'github', name: 'GitHub', summary: 'Open repositories, issues, and pull requests.', webUrl: 'https://github.com' },
  { id: 'pcapp', name: 'PC App (Custom Path)', summary: 'Launch any local desktop app using an .exe path or command.' },
]

function loadConnectorState(): ConnectorRecord {
  try {
    const raw = localStorage.getItem(CONNECTOR_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as ConnectorRecord
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

type CustomizeWorkspaceProps = {
  onPreviewFocus: (focus: { title: string; body: string; metadata?: string[]; mode?: PreviewFocusMode } | null) => void
}

export function CustomizeWorkspace({ onPreviewFocus }: CustomizeWorkspaceProps) {
  const [activeConnector, setActiveConnector] = useState(connectorItems[0])
  const [connectorState, setConnectorState] = useState<ConnectorRecord>(() => loadConnectorState())
  const [desktopPath, setDesktopPath] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const connected = connectorState[activeConnector.id]?.connected === true

  const metadata = useMemo(() => {
    const state = connectorState[activeConnector.id]
    if (!state) {
      return ['Connector detail', 'Status: not connected']
    }
    return [`Status: ${state.connected ? 'connected' : 'not connected'}`, `Updated: ${new Date(state.updatedAt).toLocaleString()}`]
  }, [activeConnector.id, connectorState])

  const saveConnectorState = (nextState: ConnectorRecord) => {
    setConnectorState(nextState)
    localStorage.setItem(CONNECTOR_STORAGE_KEY, JSON.stringify(nextState))
  }

  const setConnectedState = (nextConnected: boolean) => {
    const nextState = {
      ...connectorState,
      [activeConnector.id]: {
        connected: nextConnected,
        updatedAt: Date.now(),
      },
    }
    saveConnectorState(nextState)
  }

  const openWeb = async () => {
    if (!activeConnector.webUrl) {
      setStatusMessage('No web URL configured for this connector.')
      return
    }

    await window.electronAPI.openExternal(activeConnector.webUrl)
    setConnectedState(true)
    setStatusMessage(`Opened ${activeConnector.webUrl}`)
  }

  const launchDesktop = async () => {
    const target = activeConnector.desktopLaunch || desktopPath.trim()
    if (!target) {
      setStatusMessage('Enter an app path or command first.')
      return
    }

    const result = await window.electronAPI.computerLaunchApp(target)
    if (result.ok) {
      setConnectedState(true)
    }
    setStatusMessage(result.detail)
  }

  useEffect(() => {
    onPreviewFocus({
      title: activeConnector.name,
      body: `${activeConnector.summary}\nStatus: ${connected ? 'Connected' : 'Not connected'}`,
      metadata,
      mode: 'route',
    })
  }, [activeConnector, connected, metadata, onPreviewFocus])

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-5">
      <div className="mx-auto grid h-full max-w-7xl gap-4 rounded-[28px] border border-claude-border bg-white shadow-sm lg:grid-cols-[240px_320px_1fr]">
        <aside className="border-r border-claude-border p-5">
          <div className="text-2xl font-semibold text-claude-text">Customize</div>
          <div className="mt-6 space-y-2">
            <button type="button" className="w-full rounded-2xl px-3 py-3 text-left text-sm font-medium text-claude-secondary transition hover:bg-stone-50">
              Skills
            </button>
            <button type="button" className="w-full rounded-2xl bg-[#f1ede3] px-3 py-3 text-left text-sm font-semibold text-claude-text">
              Connectors
            </button>
          </div>

          <div className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Personal plugins</div>
          <div className="mt-3 rounded-2xl border border-claude-border bg-stone-50 px-3 py-3 text-sm text-claude-secondary">Desktop connector controls</div>
        </aside>

        <section className="border-r border-claude-border p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-semibold text-claude-text">Connectors</div>
              <div className="mt-1 text-sm text-claude-secondary">Click any connector, then open web or desktop app.</div>
            </div>
            <div className="flex gap-2 text-lg text-claude-secondary">
              <span>⌕</span>
              <span>＋</span>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {connectorItems.map((connector) => (
              <button
                key={connector.name}
                type="button"
                onClick={() => setActiveConnector(connector)}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${activeConnector.name === connector.name ? 'bg-[#f1ede3] text-claude-text' : 'bg-white text-claude-secondary hover:bg-stone-50'}`}
              >
                <div className="text-sm font-medium">{connector.name}</div>
                <div className="mt-1 text-xs opacity-70">{connector.summary}</div>
                <div className="mt-2 text-[11px] opacity-70">{connectorState[connector.id]?.connected ? 'Connected' : 'Not connected'}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-claude-border bg-white text-4xl shadow-sm">◉</div>
            <div className="mt-6 text-3xl font-semibold text-claude-text">{activeConnector.name}</div>
            <div className="mt-3 text-base text-claude-secondary">{activeConnector.summary}</div>
            <div className="mt-2 text-sm text-claude-secondary">
              Status: {connected ? 'Connected' : 'Not connected'}
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void openWeb()}
                disabled={!activeConnector.webUrl}
                className="rounded-2xl border border-claude-border bg-white px-5 py-2.5 text-sm font-medium text-claude-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open Web
              </button>
              <button
                type="button"
                onClick={() => void launchDesktop()}
                disabled={!activeConnector.desktopLaunch && activeConnector.id !== 'pcapp'}
                className="rounded-2xl border border-claude-border bg-white px-5 py-2.5 text-sm font-medium text-claude-text disabled:cursor-not-allowed disabled:opacity-40"
              >
                Launch Desktop App
              </button>
              <button
                type="button"
                onClick={() => setConnectedState(!connected)}
                className="rounded-2xl bg-black px-5 py-2.5 text-sm font-medium text-white"
              >
                {connected ? 'Disconnect' : 'Mark Connected'}
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-3 text-left">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Desktop path (optional)</div>
              <input
                value={desktopPath}
                onChange={(event) => setDesktopPath(event.target.value)}
                placeholder="C:\\Program Files\\...\\App.exe"
                className="mt-2 w-full rounded-xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none"
              />
            </div>

            {statusMessage ? (
              <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 px-4 py-3 text-sm text-claude-secondary">
                {statusMessage}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  )
}
