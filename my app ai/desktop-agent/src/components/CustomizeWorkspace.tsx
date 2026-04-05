import { useEffect, useMemo, useState } from 'react'
import type { PreviewFocusMode } from '../types/workspace'

type ConnectorRecord = Record<string, { connected: boolean; updatedAt: number }>

type ConnectorItem = {
  id: string
  name: string
  icon: string
  summary: string
  webUrl?: string
  desktopLaunch?: string
  apiTest?: {
    url: string
    method?: 'GET' | 'POST'
    body?: string
    headers?: Record<string, string>
  }
}

const CONNECTOR_STORAGE_KEY = 'silva-connectors-state'
const CONNECTOR_TOKEN_STORAGE_KEY = 'silva-connectors-auth'

const connectorItems: ConnectorItem[] = [
  { id: 'browser', icon: 'WEB', name: 'Browser (Chrome/Edge)', summary: 'Open browser apps and run research/automation flows.', webUrl: 'https://www.google.com', desktopLaunch: 'chrome.exe' },
  { id: 'whatsapp', icon: 'WA', name: 'WhatsApp', summary: 'Open WhatsApp Web or launch desktop WhatsApp client.', webUrl: 'https://web.whatsapp.com', desktopLaunch: 'WhatsApp.exe' },
  { id: 'outlook', icon: 'MAIL', name: 'Outlook', summary: 'Open Outlook Web and optionally launch desktop Outlook.', webUrl: 'https://outlook.office.com/mail', desktopLaunch: 'outlook.exe', apiTest: { url: 'https://graph.microsoft.com/v1.0/me' } },
  { id: 'tiktok', icon: 'TT', name: 'TikTok', summary: 'Open TikTok for content review workflows.', webUrl: 'https://www.tiktok.com' },
  { id: 'instagram', icon: 'IG', name: 'Instagram', summary: 'Open Instagram for social workflows.', webUrl: 'https://www.instagram.com', apiTest: { url: 'https://graph.facebook.com/me?fields=id,name' } },
  { id: 'facebook', icon: 'FB', name: 'Facebook', summary: 'Open Facebook pages, groups, and messages.', webUrl: 'https://www.facebook.com', apiTest: { url: 'https://graph.facebook.com/me?fields=id,name' } },
  { id: 'linkedin', icon: 'IN', name: 'LinkedIn', summary: 'Open LinkedIn profiles, posts, and messaging.', webUrl: 'https://www.linkedin.com', apiTest: { url: 'https://api.linkedin.com/v2/me' } },
  { id: 'phonelink', icon: 'PC', name: 'Phone Link', summary: 'Launch Windows Phone Link app for mobile-to-desktop context.', desktopLaunch: 'PhoneExperienceHost.exe' },
  { id: 'gdrive', icon: 'GD', name: 'Google Drive', summary: 'Open cloud files in Google Drive.', webUrl: 'https://drive.google.com', apiTest: { url: 'https://www.googleapis.com/drive/v3/about?fields=user,storageQuota' } },
  { id: 'onedrive', icon: 'OD', name: 'OneDrive', summary: 'Open cloud files in OneDrive.', webUrl: 'https://onedrive.live.com', apiTest: { url: 'https://graph.microsoft.com/v1.0/me/drive' } },
  { id: 'dropbox', icon: 'DB', name: 'Dropbox', summary: 'Open cloud files in Dropbox.', webUrl: 'https://www.dropbox.com/home', apiTest: { url: 'https://api.dropboxapi.com/2/users/get_current_account', method: 'POST', body: '{}' } },
  { id: 'github', icon: 'GH', name: 'GitHub', summary: 'Open repositories, issues, and pull requests.', webUrl: 'https://github.com' },
  { id: 'pcapp', icon: 'APP', name: 'PC App (Custom Path)', summary: 'Launch any local desktop app using an .exe path or command.' },
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

function loadConnectorTokens(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CONNECTOR_TOKEN_STORAGE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw) as Record<string, string>
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
  const [connectorTokens, setConnectorTokens] = useState<Record<string, string>>(() => loadConnectorTokens())
  const [tokenDraft, setTokenDraft] = useState('')
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

  const saveConnectorTokens = (nextTokens: Record<string, string>) => {
    setConnectorTokens(nextTokens)
    localStorage.setItem(CONNECTOR_TOKEN_STORAGE_KEY, JSON.stringify(nextTokens))
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

    try {
      await window.electronAPI.openExternal(activeConnector.webUrl)
      setConnectedState(true)
      setStatusMessage(`Opened ${activeConnector.webUrl}`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to open web connector.')
    }
  }

  const launchDesktop = async () => {
    const target = activeConnector.desktopLaunch || desktopPath.trim()
    if (!target) {
      setStatusMessage('Enter an app path or command first.')
      return
    }

    try {
      const result = await window.electronAPI.computerLaunchApp(target)
      if (result.ok) {
        setConnectedState(true)
      }
      setStatusMessage(result.detail)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to launch desktop app.')
    }
  }

  const saveToken = () => {
    const trimmed = tokenDraft.trim()
    const next = {
      ...connectorTokens,
      [activeConnector.id]: trimmed,
    }
    saveConnectorTokens(next)
    setStatusMessage(trimmed ? 'Access token saved locally for this connector.' : 'Token cleared for this connector.')
  }

  const clearToken = () => {
    const next = { ...connectorTokens }
    delete next[activeConnector.id]
    saveConnectorTokens(next)
    setTokenDraft('')
    setStatusMessage('Access token removed.')
  }

  const testApiConnection = async () => {
    if (!activeConnector.apiTest) {
      setStatusMessage('No API test endpoint configured for this connector.')
      return
    }

    const token = tokenDraft.trim() || connectorTokens[activeConnector.id] || ''
    if (!token) {
      setStatusMessage('Paste an access token first.')
      return
    }

    try {
      const result = await window.electronAPI.connectorTestRequest({
        url: activeConnector.apiTest.url,
        method: activeConnector.apiTest.method,
        body: activeConnector.apiTest.body,
        headers: activeConnector.apiTest.headers,
        token,
      })
      if (result.ok) {
        setConnectedState(true)
      }

      const preview = result.preview ? `\n\nPreview:\n${result.preview}` : ''
      setStatusMessage(`${result.ok ? 'API connection ok' : `API connection failed (${result.status})`}${preview}`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Connector API test failed.')
    }
  }

  useEffect(() => {
    onPreviewFocus({
      title: activeConnector.name,
      body: `${activeConnector.summary}\nStatus: ${connected ? 'Connected' : 'Not connected'}`,
      metadata,
      mode: 'route',
    })
  }, [activeConnector, connected, metadata, onPreviewFocus])

  useEffect(() => {
    setTokenDraft(connectorTokens[activeConnector.id] || '')
  }, [activeConnector.id, connectorTokens])

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
                title={connector.summary}
                className={`w-full rounded-2xl px-4 py-3 text-left transition ${activeConnector.name === connector.name ? 'bg-[#f1ede3] text-claude-text' : 'bg-white text-claude-secondary hover:bg-stone-50'}`}
              >
                <div className="text-sm font-medium">{connector.icon} {connector.name}</div>
                <div className="mt-1 text-xs opacity-70">{connector.summary}</div>
                <div className="mt-2 text-[11px] opacity-70">{connectorState[connector.id]?.connected ? 'Connected' : 'Not connected'}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-claude-border bg-white text-4xl shadow-sm">{activeConnector.icon}</div>
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

            {activeConnector.apiTest ? (
              <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-3 text-left">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Cloud API token</div>
                <input
                  type="password"
                  value={tokenDraft}
                  onChange={(event) => setTokenDraft(event.target.value)}
                  placeholder="Paste access token"
                  className="mt-2 w-full rounded-xl border border-claude-border bg-white px-3 py-2 text-sm text-claude-text outline-none"
                />
                <div className="mt-2 text-[11px] text-claude-secondary break-all">Test URL: {activeConnector.apiTest.url}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={saveToken} className="rounded-xl border border-claude-border bg-white px-3 py-2 text-xs font-medium text-claude-text">Save token</button>
                  <button type="button" onClick={() => void testApiConnection()} className="rounded-xl bg-claude-text px-3 py-2 text-xs font-medium text-white">Test API</button>
                  <button type="button" onClick={clearToken} className="rounded-xl border border-claude-border bg-white px-3 py-2 text-xs font-medium text-claude-text">Clear token</button>
                </div>
              </div>
            ) : null}

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
