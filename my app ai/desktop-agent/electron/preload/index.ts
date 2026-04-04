import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maximize: () => ipcRenderer.invoke('app:maximize'),
  close: () => ipcRenderer.invoke('app:close'),
  isMaximized: () => ipcRenderer.invoke('app:isMaximized'),

  executeBash: (command: string) => ipcRenderer.invoke('tool:bash', command),
  readFile: (path: string) => ipcRenderer.invoke('tool:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('tool:writeFile', path, content),
  listDir: (path: string) => ipcRenderer.invoke('tool:listDir', path),
  webFetch: (url: string) => ipcRenderer.invoke('tool:webFetch', url),

  getLocalProviders: () => ipcRenderer.invoke('providers:list'),
  connectProvider: (id: string, config: any) => ipcRenderer.invoke('providers:connect', id, config),
})
