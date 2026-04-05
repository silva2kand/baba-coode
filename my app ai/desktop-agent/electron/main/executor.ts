import * as electronModule from 'electron'
import * as crypto from 'crypto'
import type { ExecutorModelConfig, TaskJob, TaskStep, TaskApproval, TaskIpcEvent, ExecutorToolSchema, TaskRiskLevel } from '../../src/types/electron-api'
import { ExecutorModelAdapter } from './executor-model-adapter'
import { AgentToolsRegistry, evaluateRisk } from './permissions'
import { readTextFile, writeTextFile, executeBash } from './system-tools'

function resolveElectronApi() {
  const runtimeNamespace = electronModule as unknown as { BrowserWindow?: unknown; desktopCapturer?: unknown }
  if (runtimeNamespace.BrowserWindow && runtimeNamespace.desktopCapturer) {
    return electronModule
  }

  const fallbackDefault = (electronModule as unknown as { default?: { BrowserWindow?: unknown; desktopCapturer?: unknown } }).default
  if (fallbackDefault?.BrowserWindow && fallbackDefault?.desktopCapturer) {
    return fallbackDefault
  }

  throw new Error(
    'Electron main API unavailable inside executor. Ensure ELECTRON_RUN_AS_NODE is not set when launching the desktop app.',
  )
}

const electronApi = resolveElectronApi()
const { BrowserWindow } = electronApi
type ElectronBrowserWindow = InstanceType<typeof BrowserWindow>

const modelAdapter = new ExecutorModelAdapter()

const activeJobs = new Map<string, { job: TaskJob; aborted: boolean }>()
const pendingApprovals = new Map<string, { approvalId: string; stepId: string; resolve: (approved: boolean) => void }>()

let mainWindow: ElectronBrowserWindow | null = null

export function setExecutorWindow(win: ElectronBrowserWindow) {
  mainWindow = win
}

function emitTaskEvent(event: TaskIpcEvent) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('task:event', event)
  }
}

function generateId() {
  return crypto.randomUUID()
}

// ─── Real parameter schemas (Fix 4) ─────────────────────────────────────────

const registeredToolsSchemas: ExecutorToolSchema[] = [
  {
    name: 'browser_open',
    description: 'Launch the automated Playwright browser',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'browser_close',
    description: 'Close the automated browser',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Full URL to navigate to' } },
      required: ['url'],
      additionalProperties: false
    }
  },
  {
    name: 'browser_click',
    description: 'Click an element by CSS selector',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS selector of the element to click' } },
      required: ['selector'],
      additionalProperties: false
    }
  },
  {
    name: 'browser_type',
    description: 'Type text into an element by CSS selector',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input element' },
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['selector', 'text'],
      additionalProperties: false
    }
  },
  {
    name: 'browser_extract_text',
    description: 'Extract visible text content from the current page or a specific element',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'Optional CSS selector; omit to extract entire page text' } },
      additionalProperties: false
    }
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'browser_list_tabs',
    description: 'List all open browser tabs',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'computer_screenshot',
    description: 'Take a screenshot of the desktop screen',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'computer_mouse_move',
    description: 'Move the mouse to specific screen coordinates',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in pixels' },
        y: { type: 'number', description: 'Y coordinate in pixels' }
      },
      required: ['x', 'y'],
      additionalProperties: false
    }
  },
  {
    name: 'computer_mouse_click',
    description: 'Move and click the mouse at screen coordinates',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate in pixels' },
        y: { type: 'number', description: 'Y coordinate in pixels' }
      },
      required: ['x', 'y'],
      additionalProperties: false
    }
  },
  {
    name: 'computer_mouse_scroll',
    description: 'Scroll the mouse wheel at screen coordinates',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        scrollAmount: { type: 'number', description: 'Scroll amount in pixels, negative to scroll up' }
      },
      required: ['x', 'y', 'scrollAmount'],
      additionalProperties: false
    }
  },
  {
    name: 'computer_keyboard_type',
    description: 'Type text using the keyboard',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to type' } },
      required: ['text'],
      additionalProperties: false
    }
  },
  {
    name: 'computer_keyboard_hotkey',
    description: 'Press a keyboard shortcut',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Key name, e.g. "c", "v", "r"' },
        modifiers: { type: 'array', items: { type: 'string' }, description: 'Modifier keys: "ctrl", "alt", "shift", "windows"' }
      },
      required: ['key'],
      additionalProperties: false
    }
  },
  {
    name: 'computer_window_list',
    description: 'List all open windows on the desktop',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'computer_focus_window',
    description: 'Focus a specific window by its ID',
    parameters: {
      type: 'object',
      properties: { windowId: { type: 'number', description: 'Window ID from computer_window_list' } },
      required: ['windowId'],
      additionalProperties: false
    }
  },
  {
    name: 'system_bash_execute',
    description: 'Execute a shell command on the host OS. Use with caution.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command to execute' } },
      required: ['command'],
      additionalProperties: false
    }
  },
  {
    name: 'system_file_read',
    description: 'Read the contents of a file from the filesystem',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Absolute or relative path to the file' } },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'system_file_write',
    description: 'Write text content to a file on the filesystem',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute or relative path to the file' },
        content: { type: 'string', description: 'Text content to write' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  }
]

// ─── Task Lifecycle ──────────────────────────────────────────────────────────

export async function handleTaskStart(req: { jobId: string; title: string; initialPrompt: string; providerConfig: ExecutorModelConfig }) {
  if (activeJobs.has(req.jobId)) return { ok: false, error: 'Job already running.' }

  const job: TaskJob = {
    jobId: req.jobId,
    title: req.title,
    createdAt: Date.now(),
    status: 'running',
    steps: []
  }

  activeJobs.set(req.jobId, { job, aborted: false })
  emitTaskEvent({ type: 'job_started', job })

  runJob(job, req.providerConfig, req.initialPrompt).catch(err => {
    console.error(`Job ${req.jobId} crashed:`, err)
    emitTaskEvent({ type: 'job_failed', jobId: req.jobId, error: String(err.message) })
    activeJobs.delete(req.jobId)
  })

  return { ok: true }
}

export async function handleTaskApprove(req: { approvalId: string; jobId: string; stepId: string }) {
  const pending = pendingApprovals.get(req.jobId)
  if (!pending || pending.approvalId !== req.approvalId || pending.stepId !== req.stepId) {
    return { ok: false, error: 'Approval ID mismatch or no pending approval for this job.' }
  }
  pending.resolve(true)
  pendingApprovals.delete(req.jobId)
  return { ok: true }
}

export async function handleTaskReject(req: { approvalId: string; jobId: string; stepId: string; reason?: string }) {
  const pending = pendingApprovals.get(req.jobId)
  if (!pending || pending.approvalId !== req.approvalId || pending.stepId !== req.stepId) {
    return { ok: false, error: 'Approval ID mismatch or no pending approval for this job.' }
  }
  pending.resolve(false)
  pendingApprovals.delete(req.jobId)
  return { ok: true }
}

export async function handleTaskCancel(jobId: string) {
  const entry = activeJobs.get(jobId)
  if (!entry) return { ok: false, error: 'Job not found.' }

  entry.aborted = true
  entry.job.status = 'failed'
  emitTaskEvent({ type: 'job_failed', jobId, error: 'Cancelled by user.' })

  const pending = pendingApprovals.get(jobId)
  if (pending) {
    pending.resolve(false)
    pendingApprovals.delete(jobId)
  }

  activeJobs.delete(jobId)
  return { ok: true }
}

// ─── Planner Loop ────────────────────────────────────────────────────────────

async function runJob(job: TaskJob, config: ExecutorModelConfig, initialPrompt: string) {
  const messages: any[] = [
    {
      role: 'system',
      content: [
        'You are SILVA, a fully autonomous desktop AI agent running on Windows.',
        'You have real access to browser automation (Playwright) and computer control (Nut.js).',
        'Use tool calls to perform tasks. When the task is fully done, reply with only "done" or "Task complete."',
        'Never say you cannot do something — you have real tools available.'
      ].join('\n')
    },
    { role: 'user', content: initialPrompt }
  ]

  const entry = activeJobs.get(job.jobId)!

  while (!entry.aborted && (job.status === 'running' || job.status === 'waiting_approval')) {
    let action
    try {
      action = await modelAdapter.generateNextAction({ config, messages, tools: registeredToolsSchemas })
    } catch (err: any) {
      emitTaskEvent({ type: 'job_failed', jobId: job.jobId, error: `Model error: ${err.message}` })
      activeJobs.delete(job.jobId)
      return
    }

    if (action.type === 'final_completion') {
      job.status = 'completed'
      emitTaskEvent({ type: 'job_completed', jobId: job.jobId })
      activeJobs.delete(job.jobId)
      return
    }

    if (action.type === 'assistant_message') {
      messages.push({ role: 'assistant', content: action.content ?? '' })
      continue
    }

    if (action.type === 'tool_call' && action.toolCall) {
      const stepId = generateId()
      const riskLevel = evaluateRisk(action.toolCall.name)

      const step: TaskStep = {
        stepId,
        label: action.toolCall.name,
        toolName: action.toolCall.name,
        args: action.toolCall.arguments,
        riskLevel,
        status: 'running',
      }

      job.steps.push(step)
      emitTaskEvent({ type: 'step_started', jobId: job.jobId, step })

      // Gate on moderate and dangerous actions
      if (riskLevel === 'dangerous' || riskLevel === 'moderate') {
        job.status = 'waiting_approval'
        step.status = 'waiting_approval'
        const approvalId = generateId()

        const approval: TaskApproval = {
          approvalId,
          jobId: job.jobId,
          stepId,
          riskLevel,
          label: `Agent wants to call: ${step.toolName}`,
          toolName: step.toolName,
          argsPreview: JSON.stringify(step.args).slice(0, 80)
        }

        emitTaskEvent({ type: 'approval_needed', approval })

        const approved = await new Promise<boolean>((resolve) => {
          pendingApprovals.set(job.jobId, { approvalId, stepId, resolve })
        })

        if (entry.aborted || !approved) {
          step.status = 'failed'
          emitTaskEvent({ type: 'step_failed', jobId: job.jobId, stepId, error: 'Rejected by user.' })
          emitTaskEvent({ type: 'job_failed', jobId: job.jobId, error: 'Task halted — user denied the action.' })
          activeJobs.delete(job.jobId)
          return
        }

        job.status = 'running'
        step.status = 'running'
        // Emit updated step so UI shows it running
        emitTaskEvent({ type: 'step_started', jobId: job.jobId, step })
      }

      // ─── Execute the real tool (Fix 3) ──────────────────────────────────
      let resultStr = ''
      try {
        resultStr = await executeTool(action.toolCall.name, action.toolCall.arguments)
        step.status = 'completed'
        emitTaskEvent({ type: 'step_completed', jobId: job.jobId, stepId })
      } catch (err: any) {
        step.status = 'failed'
        emitTaskEvent({ type: 'step_failed', jobId: job.jobId, stepId, error: err.message })
        emitTaskEvent({ type: 'job_failed', jobId: job.jobId, error: err.message })
        activeJobs.delete(job.jobId)
        return
      }

      // Feed result back into the LLM context
      messages.push({
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: action.toolCall.id,
          type: 'function',
          function: {
            name: action.toolCall.name,
            arguments: JSON.stringify(action.toolCall.arguments)
          }
        }]
      })
      messages.push({
        role: 'tool',
        tool_call_id: action.toolCall.id,
        name: action.toolCall.name,
        content: resultStr
      })
    }
  }
}

// ─── Real Tool Dispatch (Fix 3) ──────────────────────────────────────────────

async function executeTool(toolName: string, args: Record<string, unknown>): Promise<string> {
  const b = () => import('./browser-automation')
  const c = () => import('./computer-control')

  switch (toolName) {
    // Browser
    case 'browser_open': {
      const r = await (await b()).handleBrowserOpen()
      if (!r.ok) throw new Error(r.detail)
      return 'Browser opened.'
    }
    case 'browser_close': {
      const r = await (await b()).handleBrowserClose()
      if (!r.ok) throw new Error(r.detail)
      return 'Browser closed.'
    }
    case 'browser_navigate': {
      const r = await (await b()).handleBrowserNavigate(args.url as string)
      if (!r.ok) throw new Error(r.detail)
      return `Navigated to ${args.url}.`
    }
    case 'browser_click': {
      const r = await (await b()).handleBrowserClick(args.selector as string)
      if (!r.ok) throw new Error(r.detail)
      return `Clicked ${args.selector}.`
    }
    case 'browser_type': {
      const r = await (await b()).handleBrowserType(args.selector as string, args.text as string)
      if (!r.ok) throw new Error(r.detail)
      return `Typed into ${args.selector}.`
    }
    case 'browser_extract_text': {
      const r = await (await b()).handleBrowserExtract(args.selector as string | undefined)
      if (!r.ok) throw new Error(r.detail)
      return String(r.data ?? '').slice(0, 8000)
    }
    case 'browser_screenshot': {
      const r = await (await b()).handleBrowserScreenshot()
      if (!r.ok) throw new Error(r.detail)
      return 'Screenshot taken.'
    }
    case 'browser_list_tabs': {
      const r = await (await b()).handleBrowserListTabs()
      if (!r.ok) throw new Error(r.detail)
      return JSON.stringify(r.data)
    }

    // Computer
    case 'computer_screenshot': {
      try {
        const electronRuntimeModule = await import('electron')
        const namespaceApi = electronRuntimeModule as unknown as { desktopCapturer?: unknown }
        const defaultApi = (electronRuntimeModule as unknown as { default?: { desktopCapturer?: unknown } }).default
        const electronRuntimeApi = namespaceApi.desktopCapturer ? namespaceApi : defaultApi
        if (!electronRuntimeApi?.desktopCapturer) {
          throw new Error('desktopCapturer API is unavailable in this runtime.')
        }
        const { desktopCapturer } = electronRuntimeApi
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1280, height: 720 }
        })
        const primary = sources[0]
        if (!primary) return 'Screenshot failed: no screen source found.'
        const dataUrl = primary.thumbnail.toDataURL()
        // Return the dataUrl so vision-capable models can inspect screen state
        return dataUrl
      } catch (err: any) {
        throw new Error(`Screenshot failed: ${err.message}`)
      }
    }
    case 'computer_mouse_move': {
      const r = await (await c()).handleComputerMouse({ action: 'move', x: args.x as number, y: args.y as number })
      if (!r.ok) throw new Error(r.detail)
      return `Mouse moved to (${args.x}, ${args.y}).`
    }
    case 'computer_mouse_click': {
      const r = await (await c()).handleComputerMouse({ action: 'click', x: args.x as number, y: args.y as number })
      if (!r.ok) throw new Error(r.detail)
      return `Mouse clicked at (${args.x}, ${args.y}).`
    }
    case 'computer_mouse_drag': {
      const r = await (await c()).handleComputerMouse({ action: 'drag', x: args.x as number, y: args.y as number, toX: args.toX as number, toY: args.toY as number })
      if (!r.ok) throw new Error(r.detail)
      return `Mouse dragged from (${args.x}, ${args.y}) to (${args.toX}, ${args.toY}).`
    }
    case 'computer_mouse_scroll': {
      const r = await (await c()).handleComputerMouse({ action: 'scroll', x: args.x as number, y: args.y as number, scrollAmount: args.scrollAmount as number })
      if (!r.ok) throw new Error(r.detail)
      return `Scrolled at (${args.x}, ${args.y}).`
    }
    case 'computer_keyboard_type': {
      const r = await (await c()).handleComputerKeyboard({ action: 'type', text: args.text as string })
      if (!r.ok) throw new Error(r.detail)
      return `Typed: "${args.text}".`
    }
    case 'computer_keyboard_hotkey': {
      const r = await (await c()).handleComputerKeyboard({ action: 'hotkey', key: args.key as string, modifiers: args.modifiers as string[] | undefined })
      if (!r.ok) throw new Error(r.detail)
      return `Pressed hotkey: ${args.key}.`
    }
    case 'computer_window_list': {
      const r = await (await c()).handleWindowList()
      return JSON.stringify(r)
    }
    case 'computer_focus_window': {
      const r = await (await c()).handleFocusWindow(args.windowId as number)
      if (!r.ok) throw new Error(r.detail)
      return `Focused window ${args.windowId}.`
    }

    // System
    case 'system_bash_execute': {
      const r = await executeBash(args.command as string)
      return `stdout: ${r.stdout}\nstderr: ${r.stderr}`
    }
    case 'system_file_read': {
      const r = await readTextFile(args.path as string)
      return r.content
    }
    case 'system_file_write': {
      await writeTextFile(args.path as string, args.content as string)
      return `File written to ${args.path}.`
    }

    default:
      throw new Error(`Unknown tool: "${toolName}". Check the tool registry.`)
  }
}
