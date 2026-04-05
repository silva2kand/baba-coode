/**
 * Task Runtime — Durable task/step/approval/checkpoint model.
 *
 * This is the foundation layer. Computer control, browser automation,
 * Cowork, and Dispatch all produce and consume tasks through this model.
 */

// ─── Core Types ───────────────────────────────────────────────

export type TaskStatus = 'pending' | 'approved' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type StepStatus = 'pending' | 'running' | 'awaiting_approval' | 'approved' | 'completed' | 'failed' | 'skipped'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskSource = 'user' | 'chat' | 'command-bar' | 'dispatch' | 'scheduled' | 'file-watcher' | 'skill'

export type ApprovalRequest = {
  id: string
  stepId: string
  taskId: string
  createdAt: number
  title: string
  description: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  toolName: string
  toolInput: Record<string, unknown>
  resolved: boolean
  resolvedAt?: number
  decision?: 'approve' | 'deny' | 'modify'
  modifiedInput?: Record<string, unknown>
}

export type TaskCheckpoint = {
  id: string
  taskId: string
  stepIndex: number
  createdAt: number
  stateSnapshot: string
  label: string
}

export type TaskStep = {
  id: string
  taskId: string
  index: number
  status: StepStatus
  title: string
  detail: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolOutput?: unknown
  error?: string
  startedAt?: number
  completedAt?: number
  requiresApproval: boolean
  approvalId?: string
}

export type Task = {
  id: string
  createdAt: number
  updatedAt: number
  status: TaskStatus
  priority: TaskPriority
  source: TaskSource
  title: string
  description: string
  steps: TaskStep[]
  checkpoints: TaskCheckpoint[]
  approvals: ApprovalRequest[]
  retryCount: number
  maxRetries: number
  result?: unknown
  error?: string
  scheduledAt?: number
  startedAt?: number
  completedAt?: number
  tags: string[]
}

// ─── Factory Functions ────────────────────────────────────────

let counter = 0
function createId(prefix: string) {
  counter += 1
  return `${prefix}-${Date.now()}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function createTask(input: {
  title: string
  description: string
  source: TaskSource
  priority?: TaskPriority
  maxRetries?: number
  scheduledAt?: number
  tags?: string[]
}): Task {
  return {
    id: createId('task'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
    priority: input.priority ?? 'normal',
    source: input.source,
    title: input.title,
    description: input.description,
    steps: [],
    checkpoints: [],
    approvals: [],
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    tags: input.tags ?? [],
  }
}

export function createStep(input: {
  taskId: string
  index: number
  title: string
  detail: string
  toolName?: string
  toolInput?: Record<string, unknown>
  requiresApproval?: boolean
}): TaskStep {
  return {
    id: createId('step'),
    taskId: input.taskId,
    index: input.index,
    status: 'pending',
    title: input.title,
    detail: input.detail,
    toolName: input.toolName,
    toolInput: input.toolInput,
    requiresApproval: input.requiresApproval ?? false,
  }
}

export function createApprovalRequest(input: {
  stepId: string
  taskId: string
  title: string
  description: string
  riskLevel: ApprovalRequest['riskLevel']
  toolName: string
  toolInput: Record<string, unknown>
}): ApprovalRequest {
  return {
    id: createId('approval'),
    stepId: input.stepId,
    taskId: input.taskId,
    createdAt: Date.now(),
    title: input.title,
    description: input.description,
    riskLevel: input.riskLevel,
    toolName: input.toolName,
    toolInput: input.toolInput,
    resolved: false,
  }
}

export function createCheckpoint(input: {
  taskId: string
  stepIndex: number
  stateSnapshot: string
  label: string
}): TaskCheckpoint {
  return {
    id: createId('checkpoint'),
    taskId: input.taskId,
    stepIndex: input.stepIndex,
    createdAt: Date.now(),
    stateSnapshot: input.stateSnapshot,
    label: input.label,
  }
}

// ─── Task Lifecycle Helpers ───────────────────────────────────

export function advanceStep(step: TaskStep, status: StepStatus, output?: unknown, error?: string): TaskStep {
  return {
    ...step,
    status,
    toolOutput: output ?? step.toolOutput,
    error: error ?? step.error,
    startedAt: status === 'running' ? Date.now() : step.startedAt,
    completedAt: status === 'completed' || status === 'failed' || status === 'skipped' ? Date.now() : step.completedAt,
  }
}

export function advanceTask(task: Task, status: TaskStatus, error?: string, result?: unknown): Task {
  return {
    ...task,
    status,
    updatedAt: Date.now(),
    error: error ?? task.error,
    result: result ?? task.result,
    startedAt: status === 'running' ? Date.now() : task.startedAt,
    completedAt: status === 'completed' || status === 'failed' || status === 'cancelled' ? Date.now() : task.completedAt,
  }
}

export function isTerminal(status: TaskStatus | StepStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled' || status === 'skipped'
}

export function canRetry(task: Task): boolean {
  return task.status === 'failed' && task.retryCount < task.maxRetries
}

export function taskProgress(task: Task): { total: number; completed: number; percent: number } {
  const total = task.steps.length
  const completed = task.steps.filter((s) => isTerminal(s.status)).length
  return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) }
}

export function pendingApprovals(task: Task): ApprovalRequest[] {
  return task.approvals.filter((a) => !a.resolved)
}
