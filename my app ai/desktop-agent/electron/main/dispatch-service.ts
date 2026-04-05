import { promises as fs } from 'node:fs'
import path from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import type { ExecutorModelConfig } from '../../src/types/electron-api'

export type DispatchTaskStatus = 'queued' | 'started' | 'completed' | 'failed' | 'removed'

export type DispatchTask = {
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

export type DispatchState = {
  running: boolean
  port: number | null
  queue: DispatchTask[]
}

type DispatchPayload = {
  title: string
  prompt: string
  source?: string
  tags?: string[]
  providerConfig?: ExecutorModelConfig
  metadata?: Record<string, unknown>
}

type PersistedDispatchState = {
  queue: DispatchTask[]
}

type DispatchEvent =
  | { type: 'dispatch_state'; state: DispatchState }
  | { type: 'dispatch_task'; task: DispatchTask }

type DispatchServiceOptions = {
  storageDir: string
  emit: (event: DispatchEvent) => void
  startTask: (request: { jobId: string; title: string; initialPrompt: string; providerConfig: ExecutorModelConfig }) => Promise<{ ok: boolean; error?: string }>
}

const DEFAULT_PORT = 47831

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class DispatchService {
  private readonly statePath: string
  private readonly emit: DispatchServiceOptions['emit']
  private readonly startTask: DispatchServiceOptions['startTask']
  private queue: DispatchTask[] = []
  private server: WebSocketServer | null = null
  private port: number | null = null
  private started = false

  constructor(options: DispatchServiceOptions) {
    this.statePath = path.join(options.storageDir, 'dispatch-queue.json')
    this.emit = options.emit
    this.startTask = options.startTask
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true })
    this.queue = await this.loadQueue()
    this.broadcastState()
  }

  getState(): DispatchState {
    return {
      running: this.started,
      port: this.port,
      queue: [...this.queue].sort((left, right) => right.updatedAt - left.updatedAt),
    }
  }

  async startServer(port = DEFAULT_PORT) {
    if (this.server) {
      return this.getState()
    }

    this.server = new WebSocketServer({ port, host: '127.0.0.1' })
    this.port = port
    this.started = true

    this.server.on('connection', (socket) => {
      socket.send(JSON.stringify({ type: 'dispatch_state', state: this.getState() }))
      socket.on('message', async (raw) => {
        const response = await this.handleSocketMessage(raw.toString())
        socket.send(JSON.stringify(response))
      })
    })

    this.server.on('close', () => {
      this.server = null
      this.port = null
      this.started = false
      this.broadcastState()
    })

    this.broadcastState()
    return this.getState()
  }

  async stopServer() {
    if (!this.server) {
      return this.getState()
    }

    const server = this.server
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })

    return this.getState()
  }

  async enqueue(payload: DispatchPayload) {
    const task: DispatchTask = {
      id: createId('dispatch'),
      title: payload.title.trim(),
      prompt: payload.prompt.trim(),
      source: payload.source?.trim() || 'remote',
      tags: payload.tags ?? [],
      providerConfig: payload.providerConfig,
      metadata: payload.metadata,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'queued',
    }

    this.queue = [task, ...this.queue]
    await this.persistQueue()
    this.emit({ type: 'dispatch_task', task })
    this.broadcastState()
    return task
  }

  async remove(taskId: string) {
    const existing = this.queue.find((task) => task.id === taskId)
    if (!existing) {
      return { ok: false, error: 'Dispatch task not found.' }
    }

    this.queue = this.queue.filter((task) => task.id !== taskId)
    await this.persistQueue()
    this.broadcastState()
    return { ok: true }
  }

  async consume(taskId: string, providerConfig?: ExecutorModelConfig) {
    const task = this.queue.find((entry) => entry.id === taskId)
    if (!task) {
      return { ok: false, error: 'Dispatch task not found.' }
    }

    const effectiveProvider = providerConfig ?? task.providerConfig
    if (!effectiveProvider) {
      return { ok: false, error: 'No provider configuration supplied for dispatch execution.' }
    }

    task.status = 'started'
    task.updatedAt = Date.now()
    await this.persistQueue()
    this.broadcastState()

    const result = await this.startTask({
      jobId: task.id,
      title: task.title,
      initialPrompt: task.prompt,
      providerConfig: effectiveProvider,
    })

    if (!result.ok) {
      task.status = 'failed'
      task.lastError = result.error
      task.updatedAt = Date.now()
      await this.persistQueue()
      this.broadcastState()
      return result
    }

    task.status = 'completed'
    task.updatedAt = Date.now()
    await this.persistQueue()
    this.broadcastState()
    return { ok: true }
  }

  private async handleSocketMessage(raw: string) {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return { ok: false, error: 'Invalid JSON payload.' }
    }

    const payload = parsed.type === 'dispatch.enqueue' ? parsed : parsed
    const title = typeof payload.title === 'string' ? payload.title : ''
    const prompt = typeof payload.prompt === 'string' ? payload.prompt : ''
    if (!title.trim() || !prompt.trim()) {
      return { ok: false, error: 'Dispatch messages require title and prompt.' }
    }

    const task = await this.enqueue({
      title,
      prompt,
      source: typeof payload.source === 'string' ? payload.source : 'remote',
      tags: Array.isArray(payload.tags) ? payload.tags.filter((value): value is string => typeof value === 'string') : [],
      providerConfig: typeof payload.providerConfig === 'object' && payload.providerConfig ? payload.providerConfig as ExecutorModelConfig : undefined,
      metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata as Record<string, unknown> : undefined,
    })

    return { ok: true, task }
  }

  private async loadQueue() {
    try {
      const raw = await fs.readFile(this.statePath, 'utf8')
      const parsed = JSON.parse(raw) as PersistedDispatchState
      return Array.isArray(parsed.queue) ? parsed.queue : []
    } catch {
      return []
    }
  }

  private async persistQueue() {
    const payload: PersistedDispatchState = { queue: this.queue }
    await fs.writeFile(this.statePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  private broadcastState() {
    const state = this.getState()
    this.emit({ type: 'dispatch_state', state })
    if (this.server) {
      const message = JSON.stringify({ type: 'dispatch_state', state })
      this.server.clients.forEach((client: WebSocket) => {
        if (client.readyState === client.OPEN) {
          client.send(message)
        }
      })
    }
  }
}