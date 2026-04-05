import * as electronModule from 'electron'
import { promises as fs } from 'node:fs'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { isIP } from 'node:net'
import { APP_ROOT, runResearch, type ResearchIpcRequest } from './research-bridge'
import { readTextFile, writeTextFile, executeBash } from './system-tools'
import { DispatchService } from './dispatch-service'
import { TaskSchedulerService } from './task-scheduler'

function resolveElectronApi() {
  const runtimeNamespace = electronModule as unknown as { app?: unknown }
  if (runtimeNamespace.app) {
    return electronModule
  }

  const fallbackDefault = (electronModule as unknown as { default?: { app?: unknown } }).default
  if (fallbackDefault?.app) {
    return fallbackDefault
  }

  throw new Error(
    'Electron runtime API unavailable. Ensure ELECTRON_RUN_AS_NODE is not set when launching the desktop app.',
  )
}

const electronApi = resolveElectronApi()
const { app, BrowserWindow, Menu, Tray, desktopCapturer, globalShortcut, ipcMain, nativeImage, screen, shell } = electronApi

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = APP_ROOT
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let tray: any = null
let dispatchService: DispatchService | null = null
let taskScheduler: TaskSchedulerService | null = null

const APP_STORAGE_NAME = 'SILVA Command Center'

type WorkspaceLayout = 'claude' | 'wide' | 'split' | 'bottom-panel' | 'right-expanded'

type DirectoryItem = {
  name: string
  path: string
  isDirectory: boolean
}

type LocalProviderProbe = {
  id: string
  name: string
  available: boolean
  models: string[]
  baseUrl: string
  detail: string
}

type ConnectorTestRequest = {
  url: string
  method?: 'GET' | 'POST'
  token?: string
  headers?: Record<string, string>
  body?: string
}

type LocalVoiceTtsRequest = {
  piperPath: string
  modelPath: string
  text: string
  outputPath?: string
}

type LocalVoiceTranscribeRequest = {
  whisperPath: string
  audioPath: string
  model?: string
  outputDir?: string
}

function ensureDirectory(targetPath: string) {
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true })
  }
}

function configureElectronStoragePaths() {
  const appDataRoot = app.getPath('appData')
  const baseStorageDir = path.join(appDataRoot, APP_STORAGE_NAME)
  const userDataDir = path.join(baseStorageDir, 'user-data')
  const cacheDir = path.join(baseStorageDir, 'cache')

  ensureDirectory(baseStorageDir)
  ensureDirectory(userDataDir)
  ensureDirectory(cacheDir)

  app.setPath('userData', userDataDir)
  app.setPath('cache', cacheDir)
  app.setAppLogsPath(path.join(baseStorageDir, 'logs'))
  app.commandLine.appendSwitch('disk-cache-dir', cacheDir)
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

configureElectronStoragePaths()

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) {
  app.quit()
  process.exit(0)
}

function extractTitle(html: string) {
  const match = html.match(/<title>(.*?)<\/title>/is)
  return match ? match[1].replace(/\s+/g, ' ').trim() : ''
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasScheme(value: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value)
}

function normalizeHttpUrl(target: string) {
  const trimmed = target.trim()
  if (!trimmed) {
    throw new Error('URL cannot be empty.')
  }

  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${parsed.protocol}`)
  }
  return parsed.toString()
}

function normalizeExternalTarget(target: string) {
  const trimmed = target.trim()
  if (!trimmed) {
    throw new Error('External target cannot be empty.')
  }

  const candidate = hasScheme(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = new URL(candidate)
  const allowedProtocols = new Set(['http:', 'https:', 'mailto:', 'ms-outlook:', 'outlook:', 'file:'])
  if (!allowedProtocols.has(parsed.protocol)) {
    throw new Error(`Blocked external protocol: ${parsed.protocol}`)
  }

  return parsed.toString()
}

async function listDirectory(targetPath: string): Promise<DirectoryItem[]> {
  const resolvedPath = path.resolve(targetPath)
  const entries = await fs.readdir(resolvedPath, { withFileTypes: true })
  return entries
    .map((entry) => ({
      name: entry.name,
      path: path.join(resolvedPath, entry.name),
      isDirectory: entry.isDirectory(),
    }))
    .sort((left, right) => Number(right.isDirectory) - Number(left.isDirectory) || left.name.localeCompare(right.name))
}



async function fetchUrl(targetUrl: string) {
  const normalized = normalizeHttpUrl(targetUrl)
  const response = await fetch(normalized)
  const contentType = response.headers.get('content-type') || 'unknown'
  const text = await response.text()
  return {
    url: normalized,
    ok: response.ok,
    status: response.status,
    contentType,
    title: extractTitle(text),
    preview: stripHtml(text).slice(0, 4000),
  }
}

function normalizeHttpOnlyUrl(target: string) {
  const parsed = new URL(normalizeHttpUrl(target))
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported connector protocol: ${parsed.protocol}`)
  }
  return parsed.toString()
}

function isPrivateNetworkTarget(hostname: string) {
  const lower = hostname.toLowerCase()
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    !lower.includes('.')
  ) {
    return true
  }

  const ipVersion = isIP(lower)
  if (ipVersion === 4) {
    const [a, b] = lower.split('.').map((part) => Number.parseInt(part, 10))
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return true
    }
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    )
  }

  if (ipVersion === 6) {
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:')
  }

  return false
}

function validateConnectorTarget(url: string) {
  const parsed = new URL(normalizeHttpOnlyUrl(url))
  if (parsed.protocol !== 'https:') {
    throw new Error('Connector API tests require HTTPS URLs to protect tokens in transit.')
  }
  if (isPrivateNetworkTarget(parsed.hostname)) {
    throw new Error('Connector API tests block localhost/private network targets for safety.')
  }
  return parsed.toString()
}

function sanitizeConnectorHeaders(headers?: Record<string, string>) {
  const blocked = new Set(['host', 'connection', 'content-length', 'upgrade', 'proxy-authorization'])
  const next: Record<string, string> = {}
  if (!headers) {
    return next
  }

  for (const [key, value] of Object.entries(headers)) {
    const trimmedKey = key.trim()
    const trimmedValue = value.trim()
    if (!trimmedKey || !trimmedValue) {
      continue
    }

    const lower = trimmedKey.toLowerCase()
    if (blocked.has(lower) || lower.startsWith('sec-')) {
      continue
    }
    next[trimmedKey] = trimmedValue
  }

  return next
}

async function connectorTestRequest(request: ConnectorTestRequest) {
  const url = validateConnectorTarget(request.url)
  const method = request.method === 'POST' ? 'POST' : 'GET'
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
  }

  if (request.token?.trim()) {
    headers.Authorization = `Bearer ${request.token.trim()}`
  }
  const customHeaders = sanitizeConnectorHeaders(request.headers)
  for (const [key, value] of Object.entries(customHeaders)) {
    headers[key] = value
  }

  const body = method === 'POST' ? (request.body ?? '') : undefined
  if (body && body.length > 100_000) {
    throw new Error('Connector request body is too large (limit: 100KB).')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
  const contentType = response.headers.get('content-type') || 'unknown'
  const text = await response.text()
  const preview = text.slice(0, 4000)

  return {
    ok: response.ok,
    status: response.status,
    url,
    contentType,
    preview,
    error: response.ok ? null : `Request failed with status ${response.status}`,
  }
}

function resolveLocalPathOrFail(rawPath: string, label: string) {
  const trimmed = rawPath.trim()
  if (!trimmed) {
    throw new Error(`${label} is required.`)
  }
  const resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(trimmed)
  if (!existsSync(resolved)) {
    throw new Error(`${label} was not found: ${resolved}`)
  }
  return resolved
}

async function runProcess(executable: string, args: string[], stdinData?: string, timeoutMs = 120_000) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`Process timeout after ${timeoutMs} ms.`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk)
      if (stdout.length > 200_000) {
        stdout = stdout.slice(-200_000)
      }
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      if (stderr.length > 200_000) {
        stderr = stderr.slice(-200_000)
      }
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })

    if (stdinData) {
      child.stdin.write(stdinData)
    }
    child.stdin.end()
  })
}

async function runLocalPiperTts(request: LocalVoiceTtsRequest) {
  const piperPath = resolveLocalPathOrFail(request.piperPath, 'Piper path')
  const modelPath = resolveLocalPathOrFail(request.modelPath, 'Piper model path')
  const text = request.text.trim()
  if (!text) {
    throw new Error('TTS sample text is required.')
  }

  const outputPath = request.outputPath?.trim()
    ? path.resolve(request.outputPath.trim())
    : path.join(app.getPath('userData'), 'voice', `piper-${Date.now()}.wav`)
  ensureDirectory(path.dirname(outputPath))

  const result = await runProcess(piperPath, ['--model', modelPath, '--output_file', outputPath], `${text}\n`, 90_000)
  if (result.code !== 0) {
    throw new Error(`Piper exited with code ${result.code}. ${result.stderr.slice(0, 300)}`)
  }

  return {
    ok: true,
    outputPath,
    detail: `Piper generated audio file at ${outputPath}`,
    stderr: result.stderr.slice(0, 1000),
  }
}

async function runLocalWhisperTranscribe(request: LocalVoiceTranscribeRequest) {
  const whisperPath = resolveLocalPathOrFail(request.whisperPath, 'Whisper path')
  const audioPath = resolveLocalPathOrFail(request.audioPath, 'Audio file path')
  const outputDir = request.outputDir?.trim() ? path.resolve(request.outputDir.trim()) : path.join(app.getPath('userData'), 'voice')
  ensureDirectory(outputDir)

  const model = request.model?.trim() || 'base'
  const result = await runProcess(whisperPath, [audioPath, '--model', model, '--output_format', 'txt', '--output_dir', outputDir], undefined, 180_000)
  if (result.code !== 0) {
    throw new Error(`Whisper exited with code ${result.code}. ${result.stderr.slice(0, 300)}`)
  }

  const transcriptPath = path.join(outputDir, `${path.parse(audioPath).name}.txt`)
  let text = ''
  if (existsSync(transcriptPath)) {
    text = await fs.readFile(transcriptPath, 'utf8')
  } else {
    text = result.stdout
  }

  return {
    ok: true,
    transcriptPath: existsSync(transcriptPath) ? transcriptPath : null,
    text: text.trim(),
    detail: existsSync(transcriptPath) ? `Transcription saved to ${transcriptPath}` : 'Transcription completed.',
    stderr: result.stderr.slice(0, 1000),
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    const data = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, data }
  } finally {
    clearTimeout(timer)
  }
}

async function probeLocalProviders(): Promise<LocalProviderProbe[]> {
  const providers = [
    { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', probeUrl: 'http://localhost:11434/api/tags' },
    { id: 'jan', name: 'Jan', baseUrl: 'http://localhost:1337/v1', probeUrl: 'http://localhost:1337/v1/models' },
    { id: 'lmstudio', name: 'LM Studio', baseUrl: 'http://localhost:1234/v1', probeUrl: 'http://localhost:1234/v1/models' },
  ] as const

  return Promise.all(
    providers.map(async (provider) => {
      try {
        const result = await fetchJsonWithTimeout(provider.probeUrl, 1200)
        if (!result.ok) {
          return {
            ...provider,
            available: false,
            models: [],
            detail: `${provider.name} is not responding on ${provider.baseUrl}.`,
          }
        }

        type ProbePayload = {
          data?: Array<{ id?: string }>
          models?: Array<{ name?: string; model?: string }>
          models_names?: string[]
          modelsList?: string[]
        }
        const payload = result.data as ProbePayload | null
        const models = Array.from(new Set([
          ...(Array.isArray(payload?.data) ? payload.data.map((item) => item?.id).filter(Boolean) : []),
          ...(Array.isArray(payload?.models) ? payload.models.map((item) => item?.name || item?.model).filter(Boolean) : []),
          ...(Array.isArray(payload?.models_names) ? payload.models_names.filter(Boolean) : []),
        ])) as string[]

        return {
          ...provider,
          available: true,
          models,
          detail: models.length ? `${provider.name} responded with ${models.length} model${models.length === 1 ? '' : 's'}.` : `${provider.name} responded, but no model list was returned.`,
        }
      } catch {
        return {
          ...provider,
          available: false,
          models: [],
          detail: `${provider.name} is offline or blocked from localhost probing.`,
        }
      }
    }),
  )
}


async function openExternalTarget(target: string) {
  const normalized = normalizeExternalTarget(target)

  await shell.openExternal(normalized)
  return { ok: true, target: normalized }
}
function applyWorkspaceLayout(layout: WorkspaceLayout) {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isMinimized()) {
    return { ok: false, layout, reason: 'Window is unavailable or currently maximized/minimized.' }
  }

  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds)
  const workArea = display.workArea
  const minWidth = 900
  const minHeight = 600

  const targetByLayout: Record<WorkspaceLayout, { width: number; height: number }> = {
    claude: { width: 1200, height: 800 },
    wide: { width: 1480, height: 860 },
    split: { width: 1540, height: 920 },
    'bottom-panel': { width: 1320, height: 920 },
    'right-expanded': { width: 1460, height: 860 },
  }

  const target = targetByLayout[layout]
  const width = Math.max(minWidth, Math.min(target.width, workArea.width))
  const height = Math.max(minHeight, Math.min(target.height, workArea.height))
  const centeredX = Math.max(workArea.x, Math.min(bounds.x + Math.round((bounds.width - width) / 2), workArea.x + workArea.width - width))
  const centeredY = Math.max(workArea.y, Math.min(bounds.y + Math.round((bounds.height - height) / 2), workArea.y + workArea.height - height))

  win.setBounds({ x: centeredX, y: centeredY, width, height }, true)
  return { ok: true, layout, bounds: win.getBounds() }
}

function ensureWindowVisible() {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }

  if (win.isMinimized()) {
    win.restore()
  }
  win.show()
  win.focus()
}

function toggleWindowVisibility() {
  if (!win || win.isDestroyed()) {
    createWindow()
    return
  }

  if (win.isVisible()) {
    win.hide()
  } else {
    ensureWindowVisible()
  }
}

function registerGlobalShortcut() {
  const shortcut = process.platform === 'darwin' ? 'CommandOrControl+Shift+Space' : 'Control+Shift+Space'
  const registered = globalShortcut.register(shortcut, () => {
    toggleWindowVisibility()
  })

  if (!registered) {
    console.warn(`[shortcut] Unable to register global shortcut: ${shortcut}`)
  }
}

function createTrayIcon() {
  if (tray) {
    return
  }

  const iconCandidates = [
    path.join(process.env.APP_ROOT, 'public', 'favicon.ico'),
    path.join(process.env.APP_ROOT, 'public', 'favicon.png'),
    path.join(process.env.APP_ROOT, 'public', 'favicon.svg'),
  ]
  const iconPath = iconCandidates.find((candidate) => existsSync(candidate))
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('SILVA Command Center')
  tray.on('click', () => {
    toggleWindowVisibility()
  })

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show / Hide',
      click: () => toggleWindowVisibility(),
    },
    {
      label: 'New Chat',
      click: () => ensureWindowVisible(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])
  tray.setContextMenu(contextMenu)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 10 },
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('[window] did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame })
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[window] render-process-gone', details)
  })
  win.webContents.on('console-message', (details) => {
    if (details.level >= 2) {
      console.error('[renderer:console]', {
        level: details.level,
        message: details.message,
        line: details.lineNumber,
        sourceId: details.sourceId,
      })
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

async function loadComputerControl() {
  return import('./computer-control')
}

function emitDispatchEvent(event: unknown) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('dispatch:event', event)
  }
}

function emitScheduleEvent(event: unknown) {
  if (win && !win.isDestroyed()) {
    win.webContents.send('schedule:event', event)
  }
}

// ... existing code ...

app.whenReady().then(async () => {
  createTrayIcon()
  registerGlobalShortcut()

  ipcMain.handle('app:minimize', () => win?.minimize())
  ipcMain.handle('app:maximize', () => win?.isMaximized() ? win?.unmaximize() : win?.maximize())
  ipcMain.handle('app:close', () => app.quit())
  ipcMain.handle('app:isMaximized', () => win?.isMaximized())
  ipcMain.handle('app:applyWorkspaceLayout', async (_event, layout: WorkspaceLayout) => applyWorkspaceLayout(layout))
  ipcMain.handle('tool:listDir', async (_event, targetPath: string) => listDirectory(targetPath || process.cwd()))
  ipcMain.handle('tool:readFile', async (_event, targetPath: string) => readTextFile(targetPath))
  ipcMain.handle('tool:writeFile', async (_event, targetPath: string, content: string) => writeTextFile(targetPath, content))
  ipcMain.handle('tool:openExternal', async (_event, target: string) => openExternalTarget(target))
  ipcMain.handle('tool:webFetch', async (_event, targetUrl: string) => fetchUrl(targetUrl))
  ipcMain.handle('connector:testRequest', async (_event, request: ConnectorTestRequest) => connectorTestRequest(request))
  ipcMain.handle('research:run', async (_event, request: ResearchIpcRequest) => runResearch(request))
  ipcMain.handle('tool:bash', async (_event, command: string) => {
    const result = await executeBash(command)
    return result
  })
  ipcMain.handle('providers:list', async () => probeLocalProviders())
  ipcMain.handle('providers:connect', () => ({ ok: false, message: 'Direct provider connections are not implemented in the Electron bridge yet.' }))
  ipcMain.handle('voice:localTts', async (_event, request: LocalVoiceTtsRequest) => runLocalPiperTts(request))
  ipcMain.handle('voice:localTranscribe', async (_event, request: LocalVoiceTranscribeRequest) => runLocalWhisperTranscribe(request))

  // ─── Computer Control (Phase 1) ─────────────────────────
  ipcMain.handle('computer:screenshot', async () => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } })
      const primarySource = sources[0]
      if (!primarySource) return { dataUrl: '', width: 0, height: 0, timestamp: Date.now() }
      const thumbnail = primarySource.thumbnail
      return { dataUrl: thumbnail.toDataURL(), width: thumbnail.getSize().width, height: thumbnail.getSize().height, timestamp: Date.now() }
    } catch {
      return { dataUrl: '', width: 0, height: 0, timestamp: Date.now() }
    }
  })
  ipcMain.handle('computer:mouse', async (_event, input: import('./computer-control').MouseInput) => {
    const { handleComputerMouse } = await loadComputerControl()
    return handleComputerMouse(input)
  })
  ipcMain.handle('computer:keyboard', async (_event, input: import('./computer-control').KeyboardInput) => {
    const { handleComputerKeyboard } = await loadComputerControl()
    return handleComputerKeyboard(input)
  })
  ipcMain.handle('computer:windowList', async () => {
    const { handleWindowList } = await loadComputerControl()
    return handleWindowList()
  })
  ipcMain.handle('computer:focusWindow', async (_event, windowId: number) => {
    const { handleFocusWindow } = await loadComputerControl()
    return handleFocusWindow(windowId)
  })
  ipcMain.handle('computer:launchApp', async (_event, appPath: string) => {
    try {
      await shell.openPath(appPath)
      return { ok: true, detail: `Launched ${appPath}` }
    } catch {
      return { ok: false, detail: `Failed to launch ${appPath}` }
    }
  })

  // ─── Browser Automation (Phase 2) ───────────────────────
  ipcMain.handle('browser:open', async () => (await import('./browser-automation')).handleBrowserOpen())
  ipcMain.handle('browser:close', async () => (await import('./browser-automation')).handleBrowserClose())
  ipcMain.handle('browser:navigate', async (_event, url: string) => (await import('./browser-automation')).handleBrowserNavigate(url))
  ipcMain.handle('browser:click', async (_event, selector: string) => (await import('./browser-automation')).handleBrowserClick(selector))
  ipcMain.handle('browser:type', async (_event, selector: string, text: string) => (await import('./browser-automation')).handleBrowserType(selector, text))
  ipcMain.handle('browser:extract', async (_event, selector?: string) => (await import('./browser-automation')).handleBrowserExtract(selector))
  ipcMain.handle('browser:screenshot', async () => (await import('./browser-automation')).handleBrowserScreenshot())
  ipcMain.handle('browser:listTabs', async () => (await import('./browser-automation')).handleBrowserListTabs())
  ipcMain.handle('browser:getSessionConfig', async () => (await import('./browser-automation')).getBrowserSessionConfig())
  ipcMain.handle('browser:configureSession', async (_event, config: any) => (await import('./browser-automation')).configureBrowserSession(config))
  ipcMain.handle('browser:scroll', async () => ({ ok: false, detail: 'Scroll is handled by page interaction via Nut.js in upcoming refactors.' }))

  createWindow()

  try {
    const { handleTaskStart, handleTaskApprove, handleTaskReject, handleTaskCancel, setExecutorWindow } = await import('./executor')
    setExecutorWindow(win!)

    ipcMain.handle('task:start', async (_event, req: any) => handleTaskStart(req))
    ipcMain.handle('task:approve', async (_event, req: any) => handleTaskApprove(req))
    ipcMain.handle('task:reject', async (_event, req: any) => handleTaskReject(req))
    ipcMain.handle('task:cancel', async (_event, jobId: string) => handleTaskCancel(jobId))

    const runtimeStorageDir = path.join(app.getPath('userData'), 'runtime')
    dispatchService = new DispatchService({
      storageDir: runtimeStorageDir,
      emit: emitDispatchEvent,
      startTask: handleTaskStart,
    })
    await dispatchService.initialize()
    await dispatchService.startServer()

    taskScheduler = new TaskSchedulerService({
      storageDir: runtimeStorageDir,
      emit: emitScheduleEvent,
      startTask: handleTaskStart,
    })
    await taskScheduler.initialize()

    ipcMain.handle('dispatch:getState', async () => dispatchService?.getState() ?? { running: false, port: null, queue: [] })
    ipcMain.handle('dispatch:startServer', async (_event, port?: number) => dispatchService?.startServer(port) ?? { running: false, port: null, queue: [] })
    ipcMain.handle('dispatch:stopServer', async () => dispatchService?.stopServer() ?? { running: false, port: null, queue: [] })
    ipcMain.handle('dispatch:enqueue', async (_event, payload: any) => dispatchService?.enqueue(payload) ?? null)
    ipcMain.handle('dispatch:consume', async (_event, taskId: string, providerConfig?: any) => dispatchService?.consume(taskId, providerConfig) ?? { ok: false, error: 'Dispatch service unavailable.' })
    ipcMain.handle('dispatch:remove', async (_event, taskId: string) => dispatchService?.remove(taskId) ?? { ok: false, error: 'Dispatch service unavailable.' })

    ipcMain.handle('schedule:list', async () => taskScheduler?.list() ?? [])
    ipcMain.handle('schedule:create', async (_event, payload: any) => taskScheduler?.create(payload) ?? null)
    ipcMain.handle('schedule:cancel', async (_event, taskId: string) => taskScheduler?.cancel(taskId) ?? { ok: false, error: 'Scheduler unavailable.' })
  } catch (error) {
    console.error('Failed to initialize runtime services:', error)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else ensureWindowVisible()
  })
})

app.on('second-instance', () => {
  if (!win || win.isDestroyed()) {
    return
  }

  if (win.isMinimized()) {
    win.restore()
  }

  win.focus()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray instead of quitting automatically.
    return
  }
})

app.on('before-quit', () => {
  globalShortcut.unregisterAll()
})
