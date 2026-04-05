import * as electronModule from 'electron'

function resolveElectronApi() {
  const runtimeNamespace = electronModule as unknown as { contextBridge?: unknown; ipcRenderer?: unknown }
  if (runtimeNamespace.contextBridge && runtimeNamespace.ipcRenderer) {
    return electronModule
  }

  const fallbackDefault = (electronModule as unknown as { default?: { contextBridge?: unknown; ipcRenderer?: unknown } }).default
  if (fallbackDefault?.contextBridge && fallbackDefault?.ipcRenderer) {
    return fallbackDefault
  }

  throw new Error(
    'Electron preload API unavailable. Ensure ELECTRON_RUN_AS_NODE is not set when launching the desktop app.',
  )
}

const electronApi = resolveElectronApi()
const { contextBridge, ipcRenderer } = electronApi

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Window Controls ────────────────────────────────────
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  isMaximized: () => ipcRenderer.invoke('app:isMaximized'),
  applyWorkspaceLayout: (layout: 'claude' | 'wide' | 'split' | 'bottom-panel' | 'right-expanded') => ipcRenderer.invoke('app:applyWorkspaceLayout', layout),

  // ─── File & Shell Tools ─────────────────────────────────
  executeBash: (command: string) => ipcRenderer.invoke('tool:bash', command),
  readFile: (path: string) => ipcRenderer.invoke('tool:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('tool:writeFile', path, content),
  openExternal: (target: string) => ipcRenderer.invoke('tool:openExternal', target),
  listDir: (path: string) => ipcRenderer.invoke('tool:listDir', path),
  webFetch: (url: string) => ipcRenderer.invoke('tool:webFetch', url),
  runResearch: (request: { inputText: string; model?: string; denyTools?: string[]; denyPrefixes?: string[] }) => ipcRenderer.invoke('research:run', request),

  // ─── Provider Management ────────────────────────────────
  getLocalProviders: () => ipcRenderer.invoke('providers:list'),
  connectProvider: (id: string, config: any) => ipcRenderer.invoke('providers:connect', id, config),

  // ─── Computer Control (Phase 1) ─────────────────────────
  computerScreenshot: () => ipcRenderer.invoke('computer:screenshot'),
  computerMouse: (input: any) => ipcRenderer.invoke('computer:mouse', input),
  computerKeyboard: (input: any) => ipcRenderer.invoke('computer:keyboard', input),
  computerWindowList: () => ipcRenderer.invoke('computer:windowList'),
  computerFocusWindow: (windowId: number) => ipcRenderer.invoke('computer:focusWindow', windowId),
  computerLaunchApp: (appPath: string) => ipcRenderer.invoke('computer:launchApp', appPath),

  // ─── Browser Automation (Phase 2) ───────────────────────
  browserOpen: () => ipcRenderer.invoke('browser:open'),
  browserClose: () => ipcRenderer.invoke('browser:close'),
  browserNavigate: (url: string) => ipcRenderer.invoke('browser:navigate', url),
  browserClick: (selector: string) => ipcRenderer.invoke('browser:click', selector),
  browserType: (selector: string, text: string) => ipcRenderer.invoke('browser:type', selector, text),
  browserScreenshot: () => ipcRenderer.invoke('browser:screenshot'),
  browserExtractText: (selector?: string) => ipcRenderer.invoke('browser:extract', selector),
  browserListTabs: () => ipcRenderer.invoke('browser:listTabs'),
  browserGetSessionConfig: () => ipcRenderer.invoke('browser:getSessionConfig'),
  browserConfigureSession: (config: any) => ipcRenderer.invoke('browser:configureSession', config),

  // ─── Dispatch Runtime (Phase 4) ─────────────────────────
  dispatchGetState: () => ipcRenderer.invoke('dispatch:getState'),
  dispatchStartServer: (port?: number) => ipcRenderer.invoke('dispatch:startServer', port),
  dispatchStopServer: () => ipcRenderer.invoke('dispatch:stopServer'),
  dispatchEnqueue: (payload: any) => ipcRenderer.invoke('dispatch:enqueue', payload),
  dispatchConsume: (taskId: string, providerConfig?: any) => ipcRenderer.invoke('dispatch:consume', taskId, providerConfig),
  dispatchRemove: (taskId: string) => ipcRenderer.invoke('dispatch:remove', taskId),
  onDispatchEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('dispatch:event', handler)
    return () => ipcRenderer.removeListener('dispatch:event', handler)
  },

  // ─── Scheduler Runtime (Phase 4) ────────────────────────
  scheduleList: () => ipcRenderer.invoke('schedule:list'),
  scheduleCreate: (payload: any) => ipcRenderer.invoke('schedule:create', payload),
  scheduleCancel: (taskId: string) => ipcRenderer.invoke('schedule:cancel', taskId),
  onScheduleEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('schedule:event', handler)
    return () => ipcRenderer.removeListener('schedule:event', handler)
  },

  // ─── Task Runtime Events (Phase 3) ──────────────────────
  taskStart: (req: any) => ipcRenderer.invoke('task:start', req),
  taskApprove: (req: any) => ipcRenderer.invoke('task:approve', req),
  taskReject: (req: any) => ipcRenderer.invoke('task:reject', req),
  taskCancel: (jobId: string) => ipcRenderer.invoke('task:cancel', jobId),
  onTaskEvent: (callback: (event: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('task:event', handler)
    return () => ipcRenderer.removeListener('task:event', handler)
  },
})
