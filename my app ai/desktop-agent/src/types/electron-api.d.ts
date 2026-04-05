import type { ResearchCommandRequest, ResearchCommandResult } from './research'

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

type BashResult = {
  stdout: string
  stderr: string
}

type ConnectorTestRequest = {
  url: string
  method?: 'GET' | 'POST'
  token?: string
  headers?: Record<string, string>
  body?: string
}

type ConnectorTestResult = {
  ok: boolean
  status: number
  url: string
  contentType: string
  preview: string
  error: string | null
}

type LocalVoiceTtsRequest = {
  piperPath: string
  modelPath: string
  text: string
  outputPath?: string
}

type LocalVoiceTtsResult = {
  ok: boolean
  outputPath: string
  detail: string
  stderr: string
}

type LocalVoiceTranscribeRequest = {
  whisperPath: string
  audioPath: string
  model?: string
  outputDir?: string
}

type LocalVoiceTranscribeResult = {
  ok: boolean
  transcriptPath: string | null
  text: string
  detail: string
  stderr: string
}

type LocalProviderProbe = {
  id: string
  name: string
  available: boolean
  models: string[]
  baseUrl: string
  detail: string
}

type WorkspaceLayoutResult = {
  ok: boolean
  layout: 'claude' | 'wide' | 'split' | 'bottom-panel' | 'right-expanded'
  reason?: string
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
}

// ─── Computer Control Types ─────────────────────────────────

type ScreenshotResult = {
  dataUrl: string
  width: number
  height: number
  timestamp: number
}

type MouseAction = 'move' | 'click' | 'doubleClick' | 'rightClick' | 'drag' | 'scroll'

type MouseInput = {
  action: MouseAction
  x?: number
  y?: number
  toX?: number
  toY?: number
  scrollAmount?: number
}

type KeyboardInput = {
  action: 'type' | 'key' | 'hotkey'
  text?: string
  key?: string
  modifiers?: string[]
}

type WindowInfo = {
  id: number
  title: string
  processName: string
  bounds: { x: number; y: number; width: number; height: number }
}

type ComputerActionResult = {
  ok: boolean
  detail: string
}

// ─── Browser Automation Types ───────────────────────────────

type BrowserPageInfo = {
  url: string
  title: string
  content: string
}

type BrowserActionResult = {
  ok: boolean
  detail: string
  screenshot?: string
  content?: string
  pageInfo?: BrowserPageInfo
  data?: any
}

type BrowserSessionChannel = 'chromium' | 'chrome' | 'msedge'

type BrowserSessionConfig = {
  channel: BrowserSessionChannel
  persistentProfile: boolean
  profileDirectory: string
  extensionPaths: string[]
}

type DispatchTaskStatus = 'queued' | 'started' | 'completed' | 'failed' | 'removed'

type DispatchTask = {
  id: string
  title: string
  prompt: string
  source: string
  tags: string[]
  createdAt: number
  updatedAt: number
  status: DispatchTaskStatus
  providerConfig?: ExecutorModelConfig
  metadata?: Record<string, unknown>
  lastError?: string
}

type DispatchState = {
  running: boolean
  port: number | null
  queue: DispatchTask[]
}

type DispatchEvent =
  | { type: 'dispatch_state'; state: DispatchState }
  | { type: 'dispatch_task'; task: DispatchTask }

type ScheduledTaskStatus = 'scheduled' | 'running' | 'completed' | 'error' | 'cancelled'

type ScheduledTask = {
  id: string
  title: string
  prompt: string
  runAt: number
  intervalMs?: number
  providerConfig: ExecutorModelConfig
  createdAt: number
  updatedAt: number
  lastRunAt?: number
  lastError?: string
  status: ScheduledTaskStatus
}

type ScheduleEvent = { type: 'schedule_state'; tasks: ScheduledTask[] }

// ─── Task Runtime IPC Types ─────────────────────────────────

export type ExecutorToolSchema = {
  name: string
  description?: string
  parameters: Record<string, unknown>
}

export type ExecutorModelConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
}

export type ExecutorActionType = 'assistant_message' | 'tool_call' | 'final_completion'

export type ExecutorToolCall = {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export type ExecutorModelAction = {
  type: ExecutorActionType
  content?: string
  toolCall?: ExecutorToolCall
}

export type TaskRiskLevel = 'safe' | 'moderate' | 'dangerous'

export type TaskStepStatus = 'pending' | 'running' | 'waiting_approval' | 'completed' | 'failed'

export type TaskStep = {
  stepId: string
  label: string
  toolName?: string
  args?: Record<string, unknown>
  riskLevel: TaskRiskLevel
  status: TaskStepStatus
  error?: string
}

export type TaskJobStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed'

export type TaskJob = {
  jobId: string
  title: string
  createdAt: number
  status: TaskJobStatus
  steps: TaskStep[]
}

export type TaskApproval = {
  approvalId: string
  jobId: string
  stepId: string
  riskLevel: TaskRiskLevel
  label: string
  toolName?: string
  argsPreview?: string
}

export type TaskIpcEvent =
  | { type: 'job_started'; job: TaskJob }
  | { type: 'step_started'; jobId: string; step: TaskStep }
  | { type: 'approval_needed'; approval: TaskApproval }
  | { type: 'step_completed'; jobId: string; stepId: string }
  | { type: 'step_failed'; jobId: string; stepId: string; error: string }
  | { type: 'job_completed'; jobId: string }
  | { type: 'job_failed'; jobId: string; error: string }

declare global {
  interface Window {
    electronAPI: {
      // ─── Window Controls ────────────────────────────────────
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      applyWorkspaceLayout: (layout: 'claude' | 'wide' | 'split' | 'bottom-panel' | 'right-expanded') => Promise<WorkspaceLayoutResult>

      // ─── File & Shell Tools ─────────────────────────────────
      executeBash: (command: string) => Promise<BashResult>
      readFile: (path: string) => Promise<FileReadResult>
      writeFile: (path: string, content: string) => Promise<{ path: string; ok: boolean }>
      openExternal: (target: string) => Promise<{ ok: boolean; target: string }>
      listDir: (path: string) => Promise<DirectoryItem[]>
      webFetch: (url: string) => Promise<WebFetchResult>
      connectorTestRequest: (request: ConnectorTestRequest) => Promise<ConnectorTestResult>
      runResearch: (request: ResearchCommandRequest) => Promise<ResearchCommandResult>
      localVoiceTts: (request: LocalVoiceTtsRequest) => Promise<LocalVoiceTtsResult>
      localVoiceTranscribe: (request: LocalVoiceTranscribeRequest) => Promise<LocalVoiceTranscribeResult>

      // ─── Provider Management ────────────────────────────────
      getLocalProviders: () => Promise<LocalProviderProbe[]>
      connectProvider: (id: string, config: unknown) => Promise<{ ok: boolean; message?: string }>

      // ─── Computer Control (Phase 1) ─────────────────────────
      computerScreenshot: () => Promise<ScreenshotResult>
      computerMouse: (input: MouseInput) => Promise<ComputerActionResult>
      computerKeyboard: (input: KeyboardInput) => Promise<ComputerActionResult>
      computerWindowList: () => Promise<WindowInfo[]>
      computerFocusWindow: (windowId: number) => Promise<ComputerActionResult>
      computerLaunchApp: (appPath: string) => Promise<ComputerActionResult>

      // ─── Browser Automation (Phase 2) ───────────────────────
      browserOpen: () => Promise<BrowserActionResult>
      browserClose: () => Promise<BrowserActionResult>
      browserNavigate: (url: string) => Promise<BrowserActionResult>
      browserClick: (selector: string) => Promise<BrowserActionResult>
      browserType: (selector: string, text: string) => Promise<BrowserActionResult>
      browserScreenshot: () => Promise<BrowserActionResult>
      browserExtractText: (selector?: string) => Promise<BrowserActionResult>
      browserListTabs: () => Promise<BrowserActionResult>
      browserGetSessionConfig: () => Promise<BrowserSessionConfig>
      browserConfigureSession: (config: Partial<BrowserSessionConfig>) => Promise<BrowserSessionConfig>

      // ─── Dispatch Runtime (Phase 4) ─────────────────────────
      dispatchGetState: () => Promise<DispatchState>
      dispatchStartServer: (port?: number) => Promise<DispatchState>
      dispatchStopServer: () => Promise<DispatchState>
      dispatchEnqueue: (payload: { title: string; prompt: string; source?: string; tags?: string[]; providerConfig?: ExecutorModelConfig; metadata?: Record<string, unknown> }) => Promise<DispatchTask>
      dispatchConsume: (taskId: string, providerConfig?: ExecutorModelConfig) => Promise<{ ok: boolean; error?: string }>
      dispatchRemove: (taskId: string) => Promise<{ ok: boolean; error?: string }>
      onDispatchEvent: (callback: (event: DispatchEvent) => void) => () => void

      // ─── Scheduler Runtime (Phase 4) ────────────────────────
      scheduleList: () => Promise<ScheduledTask[]>
      scheduleCreate: (payload: { title: string; prompt: string; runAt: number; intervalMs?: number; providerConfig: ExecutorModelConfig }) => Promise<ScheduledTask>
      scheduleCancel: (taskId: string) => Promise<{ ok: boolean; error?: string }>
      onScheduleEvent: (callback: (event: ScheduleEvent) => void) => () => void

      // ─── Task Runtime Events (Phase 3) ──────────────────────
      taskStart: (req: { jobId: string; title: string; initialPrompt: string; providerConfig: ExecutorModelConfig }) => Promise<{ ok: boolean; error?: string }>
      taskApprove: (req: { approvalId: string; jobId: string; stepId: string }) => Promise<{ ok: boolean; error?: string }>
      taskReject: (req: { approvalId: string; jobId: string; stepId: string; reason?: string }) => Promise<{ ok: boolean; error?: string }>
      taskCancel: (jobId: string) => Promise<{ ok: boolean; error?: string }>
      onTaskEvent: (callback: (event: TaskIpcEvent) => void) => () => void
    }
  }
}

export {}
