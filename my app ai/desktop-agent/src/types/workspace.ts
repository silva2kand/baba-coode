export type WorkspacePanel =
  | 'chat'
  | 'console'
  | 'memory'
  | 'search'
  | 'customize'
  | 'projects'
  | 'artifacts'
  | 'business'
  | 'legal'
  | 'accounting'
  | 'coding'
  | 'images'
  | 'reasoning'
  | 'tools'
  | 'settings'
  | 'computer'
  | 'browser'
  | 'tasks'
  | 'dispatch'

export type PreviewFocusMode = 'route' | 'research' | 'file' | 'web' | 'media' | 'runtime' | 'message' | 'computer' | 'task' | 'browser'

export type WorkspacePreviewFocus = {
  id: string
  createdAt: number
  panel: WorkspacePanel
  source: string
  mode: PreviewFocusMode
  title: string
  body: string
  metadata: string[]
}

export type SurfaceIntent = {
  id: string
  createdAt: number
  panel: WorkspacePanel
  source: string
  reason: string
  input: string
}