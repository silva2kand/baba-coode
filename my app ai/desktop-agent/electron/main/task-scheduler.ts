import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ExecutorModelConfig } from '../../src/types/electron-api'

export type ScheduledTaskStatus = 'scheduled' | 'running' | 'completed' | 'error' | 'cancelled'

export type ScheduledTask = {
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

type PersistedSchedulerState = {
  tasks: ScheduledTask[]
}

type SchedulerEvent = { type: 'schedule_state'; tasks: ScheduledTask[] }

type SchedulerOptions = {
  storageDir: string
  emit: (event: SchedulerEvent) => void
  startTask: (request: { jobId: string; title: string; initialPrompt: string; providerConfig: ExecutorModelConfig }) => Promise<{ ok: boolean; error?: string }>
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class TaskSchedulerService {
  private readonly statePath: string
  private readonly emit: SchedulerOptions['emit']
  private readonly startTask: SchedulerOptions['startTask']
  private tasks: ScheduledTask[] = []
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(options: SchedulerOptions) {
    this.statePath = path.join(options.storageDir, 'scheduled-tasks.json')
    this.emit = options.emit
    this.startTask = options.startTask
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true })
    this.tasks = await this.loadTasks()
    this.tasks.forEach((task) => this.armTask(task))
    this.broadcast()
  }

  list() {
    return [...this.tasks].sort((left, right) => left.runAt - right.runAt)
  }

  async create(input: { title: string; prompt: string; runAt: number; intervalMs?: number; providerConfig: ExecutorModelConfig }) {
    const task: ScheduledTask = {
      id: createId('schedule'),
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      runAt: input.runAt,
      intervalMs: input.intervalMs,
      providerConfig: input.providerConfig,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'scheduled',
    }

    this.tasks = [...this.tasks, task]
    await this.persistTasks()
    this.armTask(task)
    this.broadcast()
    return task
  }

  async cancel(taskId: string) {
    const existing = this.tasks.find((task) => task.id === taskId)
    if (!existing) {
      return { ok: false, error: 'Scheduled task not found.' }
    }

    existing.status = 'cancelled'
    existing.updatedAt = Date.now()
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
    }

    await this.persistTasks()
    this.broadcast()
    return { ok: true }
  }

  private armTask(task: ScheduledTask) {
    if (task.status === 'cancelled' || task.status === 'completed') {
      return
    }

    const delay = Math.max(0, task.runAt - Date.now())
    const existing = this.timers.get(task.id)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      void this.execute(task.id)
    }, delay)
    this.timers.set(task.id, timer)
  }

  private async execute(taskId: string) {
    const task = this.tasks.find((entry) => entry.id === taskId)
    if (!task || task.status === 'cancelled') {
      return
    }

    task.status = 'running'
    task.updatedAt = Date.now()
    await this.persistTasks()
    this.broadcast()

    const result = await this.startTask({
      jobId: `${task.id}-${Date.now()}`,
      title: task.title,
      initialPrompt: task.prompt,
      providerConfig: task.providerConfig,
    })

    task.lastRunAt = Date.now()
    task.updatedAt = Date.now()

    if (!result.ok) {
      task.status = 'error'
      task.lastError = result.error
    } else if (task.intervalMs && task.intervalMs > 0) {
      task.status = 'scheduled'
      task.runAt = Date.now() + task.intervalMs
      task.lastError = undefined
      this.armTask(task)
    } else {
      task.status = 'completed'
      this.timers.delete(task.id)
    }

    await this.persistTasks()
    this.broadcast()
  }

  private async loadTasks() {
    try {
      const raw = await fs.readFile(this.statePath, 'utf8')
      const parsed = JSON.parse(raw) as PersistedSchedulerState
      return Array.isArray(parsed.tasks) ? parsed.tasks : []
    } catch {
      return []
    }
  }

  private async persistTasks() {
    const payload: PersistedSchedulerState = { tasks: this.tasks }
    await fs.writeFile(this.statePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  private broadcast() {
    this.emit({ type: 'schedule_state', tasks: this.list() })
  }
}