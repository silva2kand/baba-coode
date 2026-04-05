import { create } from 'zustand'
import {
  type Task,
  type TaskStep,
  type ApprovalRequest,
  type TaskSource,
  type TaskPriority,
  type TaskStatus,
  type StepStatus,
  createTask,
  createStep,
  createApprovalRequest,
  createCheckpoint,
  advanceTask,
  advanceStep,
  canRetry,
} from '../lib/task-runtime'

// ─── Persistence ──────────────────────────────────────────────

const STORAGE_KEY = 'silva-command-center-tasks'


type TaskSnapshot = {
  tasks: Task[]
  activeTaskId: string | null
}

function loadSnapshot(): TaskSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return { tasks: [], activeTaskId: null }
  try {
    const parsed = JSON.parse(raw) as Partial<TaskSnapshot>
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      activeTaskId: typeof parsed.activeTaskId === 'string' ? parsed.activeTaskId : null,
    }
  } catch {
    return { tasks: [], activeTaskId: null }
  }
}

function saveSnapshot(snapshot: TaskSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

// ─── Store ────────────────────────────────────────────────────

type TaskState = TaskSnapshot & {
  // Task lifecycle
  addTask: (input: { title: string; description: string; source: TaskSource; priority?: TaskPriority; tags?: string[] }) => Task
  updateTaskStatus: (taskId: string, status: TaskStatus, error?: string, result?: unknown) => void
  retryTask: (taskId: string) => void
  cancelTask: (taskId: string) => void
  selectTask: (taskId: string | null) => void

  // Step management
  addStep: (taskId: string, input: { title: string; detail: string; toolName?: string; toolInput?: Record<string, unknown>; requiresApproval?: boolean }) => TaskStep | null
  updateStepStatus: (taskId: string, stepId: string, status: StepStatus, output?: unknown, error?: string) => void

  // Approval management
  requestApproval: (taskId: string, stepId: string, input: { title: string; description: string; riskLevel: ApprovalRequest['riskLevel']; toolName: string; toolInput: Record<string, unknown> }) => ApprovalRequest | null
  resolveApproval: (taskId: string, approvalId: string, decision: 'approve' | 'deny' | 'modify', modifiedInput?: Record<string, unknown>) => void

  // Checkpoints
  addCheckpoint: (taskId: string, stepIndex: number, label: string) => void

  // Queries
  pendingApprovals: () => ApprovalRequest[]
  activeTasks: () => Task[]
  completedTasks: () => Task[]

  // Cleanup
  clearCompleted: () => void

  // IPC Event Listener
  handleIpcTaskEvent: (event: any) => void
}

const initialSnapshot = loadSnapshot()

export const useTaskStore = create<TaskState>((set, get) => ({
  ...initialSnapshot,

  addTask: (input) => {
    const task = createTask(input)
    set((state) => {
      const next = { tasks: [task, ...state.tasks], activeTaskId: task.id }
      saveSnapshot(next)
      return next
    })
    return task
  },

  updateTaskStatus: (taskId, status, error, result) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === taskId ? advanceTask(t, status, error, result) : t)),
      }
      saveSnapshot(next)
      return next
    })
  },

  retryTask: (taskId) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId || !canRetry(t)) return t
          return {
            ...t,
            status: 'pending' as TaskStatus,
            retryCount: t.retryCount + 1,
            updatedAt: Date.now(),
            error: undefined,
            steps: t.steps.map((s) =>
              s.status === 'failed' ? { ...s, status: 'pending' as StepStatus, error: undefined, toolOutput: undefined } : s
            ),
          }
        }),
      }
      saveSnapshot(next)
      return next
    })
  },

  cancelTask: (taskId) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === taskId ? advanceTask(t, 'cancelled') : t)),
      }
      saveSnapshot(next)
      return next
    })
  },

  selectTask: (taskId) => {
    set((state) => {
      const next = { ...state, activeTaskId: taskId }
      saveSnapshot(next)
      return next
    })
  },

  addStep: (taskId, input) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return null
    const step = createStep({ taskId, index: task.steps.length, ...input })
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, steps: [...t.steps, step], updatedAt: Date.now() } : t
        ),
      }
      saveSnapshot(next)
      return next
    })
    return step
  },

  updateStepStatus: (taskId, stepId, status, output, error) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                updatedAt: Date.now(),
                steps: t.steps.map((s) => (s.id === stepId ? advanceStep(s, status, output, error) : s)),
              }
            : t
        ),
      }
      saveSnapshot(next)
      return next
    })
  },

  requestApproval: (taskId, stepId, input) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return null
    const approval = createApprovalRequest({ stepId, taskId, ...input })
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                updatedAt: Date.now(),
                approvals: [...t.approvals, approval],
                steps: t.steps.map((s) =>
                  s.id === stepId ? { ...s, status: 'awaiting_approval' as StepStatus, approvalId: approval.id } : s
                ),
              }
            : t
        ),
      }
      saveSnapshot(next)
      return next
    })
    return approval
  },

  resolveApproval: (taskId, approvalId, decision, modifiedInput) => {
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) => {
          if (t.id !== taskId) return t
          const updatedApprovals = t.approvals.map((a) =>
            a.id === approvalId
              ? { ...a, resolved: true, resolvedAt: Date.now(), decision, modifiedInput }
              : a
          )
          const updatedSteps = t.steps.map((s) => {
            if (s.approvalId !== approvalId) return s
            if (decision === 'deny') return { ...s, status: 'skipped' as StepStatus }
            return {
              ...s,
              status: 'approved' as StepStatus,
              toolInput: modifiedInput ?? s.toolInput,
            }
          })
          return { ...t, approvals: updatedApprovals, steps: updatedSteps, updatedAt: Date.now() }
        }),
      }
      saveSnapshot(next)
      return next
    })
  },

  addCheckpoint: (taskId, stepIndex, label) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    const cp = createCheckpoint({ taskId, stepIndex, stateSnapshot: JSON.stringify(task.steps), label })
    set((state) => {
      const next = {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === taskId ? { ...t, checkpoints: [...t.checkpoints, cp], updatedAt: Date.now() } : t
        ),
      }
      saveSnapshot(next)
      return next
    })
  },

  pendingApprovals: () => {
    return get()
      .tasks.flatMap((t) => t.approvals)
      .filter((a) => !a.resolved)
  },

  activeTasks: () => {
    return get().tasks.filter((t) => t.status === 'pending' || t.status === 'approved' || t.status === 'running' || t.status === 'paused')
  },

  completedTasks: () => {
    return get().tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')
  },

  clearCompleted: () => {
    set((state) => {
      const active = state.tasks.filter((t) => t.status !== 'completed' && t.status !== 'failed' && t.status !== 'cancelled')
      const next = { tasks: active, activeTaskId: active[0]?.id ?? null }
      saveSnapshot(next)
      return next
    })
  },

  handleIpcTaskEvent: (ev: any) => {
    if (ev.type === 'job_started') {
      // The user already created the task locally with the same jobId before calling taskStart.
      // If the task already exists, just mark it running — do NOT add a duplicate.
      const existing = get().tasks.find((t) => t.id === ev.job.jobId)
      if (existing) {
        get().updateTaskStatus(ev.job.jobId, 'running')
      } else {
        // Executor initiated a job we don't know about (e.g. from dispatch/schedule)
        // Create a new entry with the correct ID from the start
        const newTask = createTask({ title: ev.job.title, description: '', source: 'chat' })
        set((state) => ({
          ...state,
          tasks: [{ ...newTask, id: ev.job.jobId, status: 'running' }, ...state.tasks],
          activeTaskId: ev.job.jobId
        }))
      }
    } else if (ev.type === 'step_started') {
       get().updateTaskStatus(ev.jobId, 'running')
       set((state) => {
          const tasks = state.tasks.map(t => {
             if (t.id !== ev.jobId) return t
             const newStep = {
                id: ev.step.stepId, // use backend ID exactly
                taskId: ev.jobId,
                index: t.steps.length,
                status: ev.step.status,
                title: ev.step.label,
                detail: ev.step.toolName || ev.step.label,
                toolName: ev.step.toolName,
                toolInput: ev.step.args,
                requiresApproval: ev.step.riskLevel === 'dangerous' || ev.step.riskLevel === 'moderate',
                startedAt: Date.now()
             }
             return { ...t, steps: [...t.steps, newStep] }
          })
          return { ...state, tasks }
       })
    } else if (ev.type === 'step_completed') {
       get().updateStepStatus(ev.jobId, ev.stepId, 'completed')
    } else if (ev.type === 'step_failed') {
       get().updateStepStatus(ev.jobId, ev.stepId, 'failed', undefined, ev.error)
    } else if (ev.type === 'approval_needed') {
       get().updateTaskStatus(ev.approval.jobId, 'paused')
       set((state) => {
          const tasks = state.tasks.map(t => {
             if (t.id !== ev.approval.jobId) return t
             const newApproval = {
                id: ev.approval.approvalId, // use backend ID exactly
                stepId: ev.approval.stepId, // strictly link to backend stepID
                taskId: ev.approval.jobId,
                createdAt: Date.now(),
                title: 'Agent Action Requires Approval',
                description: ev.approval.label,
                riskLevel: ev.approval.riskLevel,
                toolName: ev.approval.toolName || '',
                toolInput: ev.approval.argsPreview ? { preview: ev.approval.argsPreview } : {},
                resolved: false
             }
             const steps = t.steps.map(s => s.id === ev.approval.stepId ? { ...s, approvalId: ev.approval.approvalId, status: 'awaiting_approval' as any } : s)
             return { ...t, approvals: [...t.approvals, newApproval], steps }
          })
          return { ...state, tasks }
       })
    } else if (ev.type === 'job_completed') {
       get().updateTaskStatus(ev.jobId, 'completed')
    } else if (ev.type === 'job_failed') {
       get().updateTaskStatus(ev.jobId, 'failed', ev.error)
    }
  }
}))
