import { useState } from 'react'
import { useTaskStore } from '../store/task'
import type { RuntimeEventInput } from '../store/runtime'
import { taskProgress, pendingApprovals } from '../lib/task-runtime'

type TaskWorkspaceProps = {
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onUsePrompt: (prompt: string) => void
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed': return 'bg-emerald-50 text-emerald-700'
    case 'running': return 'bg-sky-50 text-sky-700'
    case 'failed': return 'bg-rose-50 text-rose-700'
    case 'paused': return 'bg-amber-50 text-amber-700'
    case 'cancelled': return 'bg-stone-100 text-stone-500'
    case 'awaiting_approval': return 'bg-amber-50 text-amber-700'
    default: return 'bg-stone-100 text-stone-600'
  }
}

export function TaskWorkspace({ onRuntimeEvent, onUsePrompt }: TaskWorkspaceProps) {
  const { tasks, activeTaskId, selectTask, addTask, cancelTask, clearCompleted, resolveApproval } = useTaskStore()
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const selectedTask = tasks.find((t) => t.id === activeTaskId) ?? tasks[0] ?? null
  const active = tasks.filter((t) => t.status === 'pending' || t.status === 'approved' || t.status === 'running' || t.status === 'paused')
  const completed = tasks.filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled')

  const handleCreateTask = () => {
    const title = newTitle.trim()
    if (!title) return
    const task = addTask({ title, description: newDescription.trim(), source: 'user' })
    setNewTitle('')
    setNewDescription('')
    onRuntimeEvent({
      kind: 'command',
      status: 'success',
      title: `Created task: ${task.title}`,
      detail: `Task ID: ${task.id}\nDescription: ${task.description || 'No description'}`,
      panel: 'tasks',
      source: 'task-workspace',
    })
  }

  return (
    <section className="h-full overflow-auto bg-[#fbf8f2] p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {/* Header */}
        <div className="rounded-[28px] border border-claude-border bg-[#1a1d28] p-6 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Task Engine</div>
          <div className="mt-2 text-3xl font-semibold">Autonomous executor</div>
          <div className="mt-2 max-w-3xl text-sm text-white/70">
            Running real device and browser actions powered by a native OpenAI-compatible planner. Create tasks, approve high-risk actions safely, and let the agent orchestrate its own tools in the background.
          </div>
          <div className="mt-3 flex items-center gap-3 text-sm text-white/50">
            <span>{active.length} active</span>
            <span>·</span>
            <span>{completed.length} completed</span>
            <span>·</span>
            <span>{useTaskStore.getState().pendingApprovals().length} pending approvals</span>
          </div>
        </div>

        {/* Create Task */}
        <div className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Create Task</div>
          <div className="mt-3 flex gap-3">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="flex-1 rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleCreateTask}
              className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional description..."
            className="mt-2 w-full rounded-2xl border border-claude-border bg-stone-50 px-3 py-2 text-sm outline-none min-h-[60px] resize-y"
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          {/* Task List */}
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Task Queue</div>
              {completed.length > 0 ? (
                <button type="button" onClick={clearCompleted} className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text">
                  Clear completed
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {tasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-5 text-sm text-claude-secondary">
                  No tasks yet. Create one above or use a chat command to queue work.
                </div>
              ) : (
                tasks.map((task) => {
                  const progress = taskProgress(task)
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => selectTask(task.id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedTask?.id === task.id ? 'border-claude-text bg-stone-50' : 'border-claude-border bg-white hover:bg-stone-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-claude-text">{task.title}</div>
                          <div className="mt-1 text-xs text-claude-secondary">{task.source} · {new Date(task.createdAt).toLocaleString()}</div>
                        </div>
                        <div className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusBadge(task.status)}`}>
                          {task.status}
                        </div>
                      </div>
                      {task.steps.length > 0 ? (
                        <div className="mt-3">
                          <div className="h-1.5 w-full rounded-full bg-stone-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.percent}%` }} />
                          </div>
                          <div className="mt-1 text-xs text-claude-secondary">{progress.completed}/{progress.total} steps</div>
                        </div>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </section>

          {/* Task Detail */}
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Task Detail</div>
            {selectedTask ? (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-lg font-semibold text-claude-text">{selectedTask.title}</div>
                  <div className="mt-1 text-xs text-claude-secondary">
                    {selectedTask.source} · Priority: {selectedTask.priority} · Retries: {selectedTask.retryCount}/{selectedTask.maxRetries}
                  </div>
                  {selectedTask.description ? (
                    <div className="mt-2 text-sm text-claude-secondary">{selectedTask.description}</div>
                  ) : null}
                </div>

                {/* Pending Approvals */}
                {pendingApprovals(selectedTask).map((approval) => (
                  <div key={approval.id} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                    <div className="text-sm font-semibold text-amber-800">⚠ Approval Required</div>
                    <div className="mt-1 text-sm text-amber-700">{approval.title}</div>
                    <div className="mt-1 text-xs text-amber-600">{approval.description}</div>
                    {approval.toolInput?.preview ? (
                      <div className="mt-2 rounded-lg bg-amber-100 px-3 py-1.5 font-mono text-[10px] text-amber-800 break-all">{String(approval.toolInput.preview)}</div>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const step = selectedTask.steps.find((s) => s.approvalId === approval.id)
                          if (!step) return
                          const res = await window.electronAPI.taskApprove({ approvalId: approval.id, jobId: selectedTask.id, stepId: step.id })
                          if (res?.ok) {
                            resolveApproval(selectedTask.id, approval.id, 'approve')
                          } else {
                            onRuntimeEvent({ kind: 'tool', status: 'error', title: 'Approval failed', detail: res?.error ?? 'Backend rejected the approval request.', panel: 'tasks', source: 'task-workspace' })
                          }
                        }}
                        className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const step = selectedTask.steps.find((s) => s.approvalId === approval.id)
                          if (!step) return
                          const res = await window.electronAPI.taskReject({ approvalId: approval.id, jobId: selectedTask.id, stepId: step.id, reason: 'Denied from UI' })
                          if (res?.ok) {
                            resolveApproval(selectedTask.id, approval.id, 'deny')
                          } else {
                            onRuntimeEvent({ kind: 'tool', status: 'error', title: 'Reject failed', detail: res?.error ?? 'Backend rejected the denial request.', panel: 'tasks', source: 'task-workspace' })
                          }
                        }}
                        className="rounded-full border border-rose-300 bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                ))}

                {/* Steps */}
                {selectedTask.steps.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Steps</div>
                    {selectedTask.steps.map((step) => (
                      <div key={step.id} className="rounded-2xl border border-claude-border bg-stone-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-claude-text">{step.title}</div>
                          <div className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusBadge(step.status)}`}>
                            {step.status}
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-claude-secondary">{step.detail}</div>
                        {step.error ? <div className="mt-1 text-xs text-rose-600">Error: {step.error}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">
                    No steps defined yet. The task engine or chat commands will add steps automatically.
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {selectedTask.status === 'pending' || selectedTask.status === 'failed' ? (
                    <button type="button" onClick={async () => {
                      const configStr = localStorage.getItem('silva-openai-config')
                      const storedConfig = configStr ? JSON.parse(configStr) : {}
                      
                      const providerConfig = {
                         baseUrl: storedConfig.baseUrl || 'http://127.0.0.1:1234/v1',
                         apiKey: storedConfig.apiKey || 'lm-studio',
                         model: storedConfig.model || 'local-model'
                      }

                      // Await backend acknowledgment — do not claim success optimistically
                      const res = await window.electronAPI.taskStart({
                        jobId: selectedTask.id,
                        title: selectedTask.title,
                        initialPrompt: selectedTask.title + '\n' + selectedTask.description,
                        providerConfig
                      })

                      onRuntimeEvent({
                        kind: 'tool',
                        status: res?.ok ? 'success' : 'error',
                        title: res?.ok ? 'Task Execution Started' : 'Task Start Failed',
                        detail: res?.ok
                          ? `Task "${selectedTask.title}" handed off to background executor.`
                          : (res?.error ?? 'Executor rejected the start request.'),
                        panel: 'tasks',
                        source: 'task-workspace'
                      })
                    }} className="rounded-full bg-claude-text px-6 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-black/80 hover:shadow-lg active:scale-95">
                      Start Execution
                    </button>
                  ) : null}
                  {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && selectedTask.status !== 'failed' ? (
                    <button type="button" onClick={() => {
                        cancelTask(selectedTask.id)
                        void window.electronAPI.taskCancel(selectedTask.id)
                    }} className="rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95">
                      Cancel
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onUsePrompt(`Analyze this task and suggest next steps:\n\nTitle: ${selectedTask.title}\nDescription: ${selectedTask.description}\nStatus: ${selectedTask.status}\nSteps: ${selectedTask.steps.length}`)} className="rounded-full border border-claude-border bg-stone-50 px-4 py-1.5 text-xs font-semibold text-claude-text transition hover:bg-stone-100 active:scale-95">
                    Send to chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex min-h-[250px] items-center justify-center rounded-3xl border border-dashed border-claude-border bg-stone-50 p-6 text-center text-sm text-claude-secondary transition-all">
                Select a task to inspect it, or create a new one above.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  )
}

