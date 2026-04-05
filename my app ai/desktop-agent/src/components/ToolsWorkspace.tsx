import { useEffect, useState } from 'react'
import { useArtifactStore } from '../store/artifacts'
import { useMemoryStore } from '../store/memory'
import type { RuntimeEventInput } from '../store/runtime'
import { useSettingsStore } from '../store/settings'
import { parseWhatsAppExport } from '../lib/whatsapp-parser'
import { toFileArtifact, toWebArtifact } from '../types/research'

const DEFAULT_PATH = 'c:\\Users\\Silva\\WORKSPACE\\my app ai'

type DirectoryItem = {
  name: string
  path: string
  isDirectory: boolean
}

type FileReadResult = {
  path: string
  size: number
  content: string
  truncated: boolean
}

type WebFetchResult = {
  url: string
  ok: boolean
  status: number
  contentType: string
  title: string
  preview: string
}

type ToolsWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onArtifactCreated: (title: string, detail: string) => void
}

export function ToolsWorkspace({ onUsePrompt, onRuntimeEvent, onArtifactCreated }: ToolsWorkspaceProps) {
  const { tools, privacy } = useSettingsStore()
  const { addArtifact, selectArtifact } = useArtifactStore()
  const addMemoryEntry = useMemoryStore((state) => state.addEntry)
  const [directoryPath, setDirectoryPath] = useState(DEFAULT_PATH)
  const [directoryItems, setDirectoryItems] = useState<DirectoryItem[]>([])
  const [directoryError, setDirectoryError] = useState('')
  const [selectedFile, setSelectedFile] = useState<FileReadResult | null>(null)
  const [url, setUrl] = useState('https://example.com')
  const [webResult, setWebResult] = useState<WebFetchResult | null>(null)
  const [webError, setWebError] = useState('')
  const [loadingDir, setLoadingDir] = useState(false)
  const [loadingWeb, setLoadingWeb] = useState(false)
  const [whatsAppPath, setWhatsAppPath] = useState('')
  const [whatsAppSummary, setWhatsAppSummary] = useState('')

  const saveFileArtifact = () => {
    if (!selectedFile) {
      return
    }
    const artifact = toFileArtifact(selectedFile)
    addArtifact(artifact)
    selectArtifact(artifact.id)
    onArtifactCreated(artifact.title, `Saved file artifact from ${artifact.path}.`)
  }

  const saveWebArtifact = () => {
    if (!webResult) {
      return
    }
    const artifact = toWebArtifact(webResult)
    addArtifact(artifact)
    selectArtifact(artifact.id)
    onArtifactCreated(artifact.title, `Saved web artifact from ${artifact.url}.`)
  }

  const fileAccessBlocked = privacy.disableFileAccess.enabled || !tools.fileTools.enabled || !tools.fileTools.available
  const webAccessBlocked = privacy.disableExternalRequests.enabled || privacy.disableWebFetch.enabled || !tools.webFetch.enabled || !tools.webFetch.available

  const loadDirectory = async (targetPath: string) => {
    if (fileAccessBlocked) {
      setDirectoryError('File access is currently blocked by tool or privacy settings.')
      return
    }

    setLoadingDir(true)
    setDirectoryError('')
    try {
      const nextItems = await window.electronAPI.listDir(targetPath)
      setDirectoryItems(nextItems)
      setDirectoryPath(targetPath)
      onRuntimeEvent({
        kind: 'tool',
        status: 'success',
        title: 'Listed directory',
        detail: `${targetPath}\n${nextItems.length} entries returned.`,
        panel: 'console',
        source: 'tools-workspace',
        preview: {
          title: 'Directory listing',
          body: nextItems.slice(0, 12).map((item) => `${item.isDirectory ? '[dir]' : '[file]'} ${item.name}`).join('\n') || 'Directory is empty.',
          metadata: [targetPath, `${nextItems.length} entries`],
          mode: 'runtime',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load directory.'
      setDirectoryError(message)
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'Directory listing failed',
        detail: `${targetPath}\n${message}`,
        panel: 'console',
        source: 'tools-workspace',
      })
    } finally {
      setLoadingDir(false)
    }
  }

  const loadFile = async (targetPath: string) => {
    if (fileAccessBlocked) {
      setDirectoryError('File access is currently blocked by tool or privacy settings.')
      return
    }

    try {
      const result = await window.electronAPI.readFile(targetPath)
      setSelectedFile(result)
      onRuntimeEvent({
        kind: 'tool',
        status: 'success',
        title: 'Opened file preview',
        detail: `${result.path}\n${result.size.toLocaleString()} bytes${result.truncated ? ' · preview truncated' : ''}`,
        panel: 'console',
        source: 'tools-workspace',
        preview: {
          title: result.path.split(/[/\\]/).pop() || result.path,
          body: result.content,
          metadata: [result.path, `${result.size.toLocaleString()} bytes${result.truncated ? ' · truncated' : ''}`],
          mode: 'file',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read file.'
      setDirectoryError(message)
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'File preview failed',
        detail: `${targetPath}\n${message}`,
        panel: 'console',
        source: 'tools-workspace',
      })
    }
  }

  const fetchWeb = async () => {
    if (webAccessBlocked) {
      setWebError('Web access is currently blocked by tool or privacy settings.')
      return
    }

    setLoadingWeb(true)
    setWebError('')
    try {
      const result = await window.electronAPI.webFetch(url)
      setWebResult(result)
      onRuntimeEvent({
        kind: 'tool',
        status: result.ok ? 'success' : 'error',
        title: 'Fetched web page',
        detail: `${result.url}\nStatus: ${result.status}\nContent-Type: ${result.contentType}`,
        panel: 'console',
        source: 'tools-workspace',
        preview: {
          title: result.title || result.url,
          body: result.preview,
          metadata: [result.url, `Status ${result.status}`, result.contentType || 'unknown content'],
          mode: 'web',
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to fetch URL.'
      setWebError(message)
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'Web fetch failed',
        detail: `${url}\n${message}`,
        panel: 'console',
        source: 'tools-workspace',
      })
    } finally {
      setLoadingWeb(false)
    }
  }

  const ingestWhatsAppExport = async () => {
    const targetPath = whatsAppPath.trim()
    if (!targetPath) {
      setDirectoryError('Enter a WhatsApp export text file path first.')
      return
    }

    try {
      const result = await window.electronAPI.readFile(targetPath)
      const parsed = parseWhatsAppExport(result.content)
      const participants = parsed.participants.slice(0, 8).map((item) => `${item.name} (${item.count})`).join(', ')
      const actions = parsed.actionItems.slice(0, 8).join('\n- ')
      const summary = [
        `Total messages: ${parsed.totalMessages}`,
        `Participants: ${participants || 'unknown'}`,
        '',
        'Recent sample:',
        ...parsed.sample.slice(-8).map((message) => `- [${message.timestamp}] ${message.sender}: ${message.text}`),
        '',
        'Action-like lines:',
        actions ? `- ${actions}` : '- none detected',
      ].join('\n')

      setWhatsAppSummary(summary)
      addMemoryEntry({
        kind: 'runtime',
        title: `WhatsApp ingestion · ${result.path.split(/[/\\]/).pop() || 'chat export'}`,
        content: summary,
        sourceLabel: 'whatsapp-export',
      })

      const artifact = toFileArtifact({
        path: result.path,
        size: result.size,
        content: summary,
        truncated: false,
      })
      addArtifact(artifact)
      selectArtifact(artifact.id)
      onArtifactCreated(artifact.title, `Saved WhatsApp ingestion summary from ${result.path}.`)

      onRuntimeEvent({
        kind: 'tool',
        status: 'success',
        title: 'WhatsApp export ingested',
        detail: `${result.path}\n${parsed.totalMessages} messages parsed.`,
        panel: 'tools',
        source: 'tools-workspace',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ingest WhatsApp export.'
      setDirectoryError(message)
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'WhatsApp ingestion failed',
        detail: `${targetPath}\n${message}`,
        panel: 'tools',
        source: 'tools-workspace',
      })
    }
  }

  useEffect(() => {
    if (!fileAccessBlocked) {
      void loadDirectory(DEFAULT_PATH)
    }
  }, [fileAccessBlocked])

  return (
    <section className="h-full overflow-auto bg-stone-50/70 p-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-3xl border border-claude-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-claude-secondary">
            <span>Tools workspace</span>
            <span className={`rounded-full px-2 py-1 ${fileAccessBlocked && webAccessBlocked ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {fileAccessBlocked && webAccessBlocked ? 'Partially blocked' : 'Live'}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-claude-text">Machine-side tools with visible guardrails</h2>
          <p className="mt-2 max-w-3xl text-sm text-claude-secondary">
            This surface now exposes real file inspection and URL fetch flows through Electron IPC. Privacy toggles still apply, so blocked settings take effect immediately instead of being decorative.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">File tools</div>
                <div className="mt-1 text-sm text-claude-secondary">Browse a folder and preview text files directly from the command center.</div>
              </div>
              <button
                type="button"
                onClick={() => void loadDirectory(directoryPath)}
                disabled={loadingDir}
                className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
              >
                {loadingDir ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={directoryPath}
                onChange={(event) => setDirectoryPath(event.target.value)}
                className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => void loadDirectory(directoryPath)}
                className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white"
              >
                Open
              </button>
            </div>

            {directoryError ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{directoryError}</div> : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="max-h-[26rem] overflow-auto rounded-2xl border border-claude-border bg-stone-50 p-2">
                {directoryItems.length === 0 ? (
                  <div className="p-3 text-sm text-claude-secondary">No directory entries loaded yet.</div>
                ) : (
                  directoryItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => item.isDirectory ? void loadDirectory(item.path) : void loadFile(item.path)}
                      className="mb-2 flex w-full items-center justify-between rounded-2xl border border-transparent bg-white px-3 py-2 text-left text-sm text-claude-text transition hover:border-claude-border"
                    >
                      <span className="truncate">{item.name}</span>
                      <span className="text-[11px] uppercase tracking-[0.14em] text-claude-secondary">{item.isDirectory ? 'Dir' : 'File'}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-claude-text">Preview</div>
                  {selectedFile ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveFileArtifact}
                        className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                      >
                        Save artifact
                      </button>
                      <button
                        type="button"
                        onClick={() => onUsePrompt(`Summarize this file and highlight action items:\n\nPath: ${selectedFile.path}\n\n${selectedFile.content.slice(0, 5000)}`)}
                        className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                      >
                        Send to chat
                      </button>
                    </div>
                  ) : null}
                </div>
                {selectedFile ? (
                  <>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedFile.path}</div>
                    <div className="mt-2 text-xs text-claude-secondary">{selectedFile.size.toLocaleString()} bytes {selectedFile.truncated ? '· preview truncated' : ''}</div>
                    <pre className="mt-3 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs text-claude-text">{selectedFile.content}</pre>
                  </>
                ) : (
                  <div className="mt-3 text-sm text-claude-secondary">Select a text file to preview it here.</div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Web fetch</div>
                <div className="mt-1 text-sm text-claude-secondary">Fetch a URL, inspect its title and content preview, then send it into command chat.</div>
              </div>
              <button
                type="button"
                onClick={() => void fetchWeb()}
                disabled={loadingWeb}
                className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
              >
                {loadingWeb ? 'Fetching...' : 'Fetch'}
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => void fetchWeb()}
                className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white"
              >
                Run
              </button>
            </div>

            {webError ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{webError}</div> : null}

            <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4">
              {webResult ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-claude-text">{webResult.title || webResult.url}</div>
                      <div className="mt-1 text-xs text-claude-secondary">{webResult.status} · {webResult.contentType}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onUsePrompt(`Research this page and summarize the important facts:\n\nURL: ${webResult.url}\nTitle: ${webResult.title}\n\n${webResult.preview}`)}
                      className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                    >
                      Send to chat
                    </button>
                    <button
                      type="button"
                      onClick={saveWebArtifact}
                      className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                    >
                      Save artifact
                    </button>
                  </div>
                  <div className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm text-claude-text">{webResult.preview}</div>
                </>
              ) : (
                <div className="text-sm text-claude-secondary">Fetch a page to inspect its title and text preview here.</div>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">WhatsApp export ingestion</div>
              <div className="mt-1 text-sm text-claude-secondary">Load a WhatsApp exported chat `.txt` file and turn it into structured memory/artifact context.</div>
            </div>
            <button type="button" onClick={() => void ingestWhatsAppExport()} className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white">
              Import
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={whatsAppPath}
              onChange={(event) => setWhatsAppPath(event.target.value)}
              placeholder="C:\\path\\to\\WhatsApp Chat with ....txt"
              className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none"
            />
            <button type="button" onClick={() => void ingestWhatsAppExport()} className="rounded-2xl border border-claude-border px-4 py-2 text-sm font-medium text-claude-text">
              Parse
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4">
            {whatsAppSummary ? (
              <>
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Parsed summary</div>
                <pre className="max-h-[20rem] overflow-auto whitespace-pre-wrap text-xs text-claude-text">{whatsAppSummary}</pre>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Use this WhatsApp ingestion summary:\n\n${whatsAppSummary}`)}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                  >
                    Send to chat
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm text-claude-secondary">Import a WhatsApp export text file to generate structured summary here.</div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
