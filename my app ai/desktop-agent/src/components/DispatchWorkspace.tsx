import { useEffect, useState } from 'react'
import type { RuntimeEventInput } from '../store/runtime'

type DispatchWorkspaceProps = {
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onUsePrompt: (prompt: string) => void
}

function readStoredProviderConfig(): ExecutorModelConfig | null {
  try {
    const raw = localStorage.getItem('silva-openai-config')
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<ExecutorModelConfig>
    if (!parsed.baseUrl || !parsed.apiKey || !parsed.model) {
      return null
    }

    return {
      baseUrl: parsed.baseUrl,
      apiKey: parsed.apiKey,
      model: parsed.model,
      temperature: parsed.temperature,
      maxTokens: parsed.maxTokens,
    }
  } catch {
    return null
  }
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString()
}

const workflowPresets = [
  {
    title: 'WhatsApp morning triage',
    prompt: 'Open WhatsApp Web or the desktop app, review unread conversations from today, summarize action items, and draft suggested replies for the urgent threads.',
  },
  {
    title: 'Chrome page to task',
    prompt: 'Open the relevant browser context, inspect the current page, extract the important content, and turn it into a concise task list with next actions.',
  },
  {
    title: 'Desktop app follow-up',
    prompt: 'Open the relevant Windows application, gather the information needed for follow-up, and prepare the summary plus the next three actions.',
  },
]

export function DispatchWorkspace({ onRuntimeEvent, onUsePrompt }: DispatchWorkspaceProps) {
  const [dispatchState, setDispatchState] = useState<DispatchState>({ running: false, port: null, queue: [] })
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [port, setPort] = useState('47831')
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [intervalMinutes, setIntervalMinutes] = useState('')

  const openSenderPage = async () => {
    const senderUrl = new URL('dispatch-sender.html', window.location.href).toString()
    await window.electronAPI.openExternal(senderUrl)
    onRuntimeEvent({
      kind: 'tool',
      status: 'success',
      title: 'Opened Dispatch sender',
      detail: senderUrl,
      panel: 'dispatch',
      source: 'dispatch-workspace',
    })
  }

  useEffect(() => {
    let disposed = false

    const hydrate = async () => {
      const [nextDispatchState, nextScheduledTasks] = await Promise.all([
        window.electronAPI.dispatchGetState(),
        window.electronAPI.scheduleList(),
      ])

      if (!disposed) {
        setDispatchState(nextDispatchState)
        setScheduledTasks(nextScheduledTasks)
      }
    }

    void hydrate()

    const unsubDispatch = window.electronAPI.onDispatchEvent((event) => {
      if (event.type === 'dispatch_state') {
        setDispatchState(event.state)
      }
    })
    const unsubSchedule = window.electronAPI.onScheduleEvent((event) => {
      if (event.type === 'schedule_state') {
        setScheduledTasks(event.tasks)
      }
    })

    return () => {
      disposed = true
      unsubDispatch()
      unsubSchedule()
    }
  }, [])

  const enqueueDispatch = async () => {
    const nextTitle = title.trim()
    const nextPrompt = prompt.trim()
    if (!nextTitle || !nextPrompt) {
      return
    }

    const task = await window.electronAPI.dispatchEnqueue({
      title: nextTitle,
      prompt: nextPrompt,
      source: 'desktop-ui',
      providerConfig: readStoredProviderConfig() ?? undefined,
    })

    setTitle('')
    setPrompt('')
    onRuntimeEvent({
      kind: 'tool',
      status: 'success',
      title: 'Dispatch queued',
      detail: `Queued ${task.title} for desktop intake.`,
      panel: 'dispatch',
      source: 'dispatch-workspace',
    })
  }

  const createSchedule = async () => {
    const providerConfig = readStoredProviderConfig()
    if (!providerConfig) {
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'Schedule creation failed',
        detail: 'Save an OpenAI-compatible provider config before creating scheduled tasks.',
        panel: 'dispatch',
        source: 'dispatch-workspace',
      })
      return
    }

    const runAt = Date.parse(scheduleAt)
    if (!Number.isFinite(runAt)) {
      return
    }

    const result = await window.electronAPI.scheduleCreate({
      title: title.trim() || 'Scheduled task',
      prompt: prompt.trim() || title.trim(),
      runAt,
      intervalMs: intervalMinutes.trim() ? Math.max(1, Number(intervalMinutes)) * 60_000 : undefined,
      providerConfig,
    })

    setScheduleAt('')
    setIntervalMinutes('')
    onRuntimeEvent({
      kind: 'tool',
      status: 'success',
      title: 'Scheduled task created',
      detail: `${result.title} will run at ${formatDateTime(result.runAt)}.`,
      panel: 'dispatch',
      source: 'dispatch-workspace',
    })
  }

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-[28px] border border-claude-border bg-gradient-to-br from-[#1f2430] to-[#25364a] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Dispatch + Scheduler</div>
          <div className="mt-2 text-3xl font-semibold">Mobile-to-desktop intake and timed execution</div>
          <div className="mt-2 max-w-3xl text-sm text-white/70">
            Dispatch now runs as a local WebSocket intake service, and scheduled tasks execute through the native background executor using your saved model provider.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-medium text-emerald-300">
              {dispatchState.running ? `Dispatch live on ${dispatchState.port}` : 'Dispatch offline'}
            </span>
            <span className="rounded-full bg-sky-500/20 px-3 py-1 font-medium text-sky-200">
              {scheduledTasks.filter((task) => task.status === 'scheduled').length} scheduled
            </span>
            <button type="button" onClick={() => void openSenderPage()} className="rounded-full bg-white/10 px-3 py-1 font-medium text-white">
              Open sender page
            </button>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Dispatch Server</div>
                <div className="mt-1 text-sm text-claude-secondary">Accept remote queue payloads over localhost WebSocket.</div>
              </div>
              <div className="flex gap-2">
                <input value={port} onChange={(event) => setPort(event.target.value)} className="w-28 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
                <button
                  type="button"
                  onClick={async () => setDispatchState(await window.electronAPI.dispatchStartServer(Number(port) || 47831))}
                  className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-semibold text-white"
                >
                  Start
                </button>
                <button
                  type="button"
                  onClick={async () => setDispatchState(await window.electronAPI.dispatchStopServer())}
                  className="rounded-2xl border border-claude-border px-4 py-2 text-sm font-semibold text-claude-text"
                >
                  Stop
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">
              {dispatchState.running
                ? `Connect a mobile or remote client to ws://127.0.0.1:${dispatchState.port} and send JSON with title and prompt.`
                : 'Start the local Dispatch server to receive remote handoff requests.'}
            </div>

            <div className="mt-4 grid gap-2">
              {workflowPresets.map((preset) => (
                <button
                  key={preset.title}
                  type="button"
                  onClick={() => {
                    setTitle(preset.title)
                    setPrompt(preset.prompt)
                  }}
                  className="rounded-2xl border border-claude-border bg-stone-50 px-4 py-3 text-left text-sm text-claude-text transition hover:bg-white"
                >
                  <div className="font-semibold">{preset.title}</div>
                  <div className="mt-1 text-xs text-claude-secondary">{preset.prompt}</div>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3">
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Task title" className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt or handoff instructions" className="min-h-[120px] rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void enqueueDispatch()} className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-semibold text-white">Queue Dispatch</button>
                <button type="button" onClick={() => onUsePrompt(prompt || title)} className="rounded-2xl border border-claude-border px-4 py-2 text-sm font-semibold text-claude-text">Send to chat</button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Scheduler</div>
            <div className="mt-1 text-sm text-claude-secondary">Create one-shot or recurring tasks that run through the native executor.</div>
            <div className="mt-4 grid gap-3">
              <input type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
              <input value={intervalMinutes} onChange={(event) => setIntervalMinutes(event.target.value)} placeholder="Recurring interval in minutes (optional)" className="rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none" />
              <button type="button" onClick={() => void createSchedule()} className="rounded-2xl bg-[#20425b] px-4 py-2 text-sm font-semibold text-white">Create Schedule</button>
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Queued Dispatches</div>
            <div className="mt-4 space-y-3">
              {dispatchState.queue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">No queued dispatch tasks yet.</div>
              ) : dispatchState.queue.map((task) => (
                <div key={task.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-claude-text">{task.title}</div>
                      <div className="mt-1 text-xs text-claude-secondary">{task.source} · {formatDateTime(task.createdAt)}</div>
                    </div>
                    <div className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-claude-secondary">{task.status}</div>
                  </div>
                  <div className="mt-2 line-clamp-3 text-sm text-claude-secondary">{task.prompt}</div>
                  {task.lastError ? <div className="mt-2 text-xs text-rose-600">{task.lastError}</div> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await window.electronAPI.dispatchConsume(task.id, readStoredProviderConfig() ?? undefined)
                        onRuntimeEvent({
                          kind: 'tool',
                          status: result.ok ? 'success' : 'error',
                          title: result.ok ? 'Dispatch consumed' : 'Dispatch consume failed',
                          detail: result.ok ? `${task.title} was handed to the executor.` : (result.error ?? 'Dispatch consume failed.'),
                          panel: 'dispatch',
                          source: 'dispatch-workspace',
                        })
                      }}
                      className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Run
                    </button>
                    <button type="button" onClick={() => void window.electronAPI.dispatchRemove(task.id)} className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-semibold text-claude-text">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Scheduled Tasks</div>
            <div className="mt-4 space-y-3">
              {scheduledTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">No scheduled tasks yet.</div>
              ) : scheduledTasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-claude-border bg-stone-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-claude-text">{task.title}</div>
                      <div className="mt-1 text-xs text-claude-secondary">Runs at {formatDateTime(task.runAt)}</div>
                    </div>
                    <div className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-claude-secondary">{task.status}</div>
                  </div>
                  {task.intervalMs ? <div className="mt-2 text-xs text-claude-secondary">Repeats every {Math.round(task.intervalMs / 60000)} minutes</div> : null}
                  {task.lastError ? <div className="mt-2 text-xs text-rose-600">{task.lastError}</div> : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => void window.electronAPI.scheduleCancel(task.id)} className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-semibold text-claude-text">Cancel</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">External Clients</div>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">
              <div className="font-semibold text-claude-text">Mobile-friendly sender page</div>
              <div className="mt-1">Open the bundled sender page to queue tasks from any browser on the same machine or network route.</div>
              <div className="mt-2 font-mono text-xs text-claude-text">public/dispatch-sender.html</div>
            </div>
            <div className="rounded-2xl border border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">
              <div className="font-semibold text-claude-text">Chrome bridge extension</div>
              <div className="mt-1">Load the unpacked extension to send the current page into Dispatch directly from Chrome or Edge.</div>
              <div className="mt-2 font-mono text-xs text-claude-text">browser-extension/dispatch-bridge-extension</div>
            </div>
          </div>
        </section>
      </div>
    </section>
  )
}