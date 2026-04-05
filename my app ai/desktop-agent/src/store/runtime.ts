import { create } from 'zustand'
import type { PreviewFocusMode, WorkspacePanel } from '../types/workspace'

const STORAGE_KEY = 'silva-command-center-runtime'

export type RuntimeEventKind = 'command' | 'tool' | 'research' | 'artifact' | 'route'
export type RuntimeEventStatus = 'info' | 'running' | 'success' | 'error'

export type RuntimeEventPreview = {
  title: string
  body: string
  metadata?: string[]
  mode?: PreviewFocusMode
}

export type RuntimeEvent = {
  id: string
  createdAt: number
  kind: RuntimeEventKind
  status: RuntimeEventStatus
  title: string
  detail: string
  panel: WorkspacePanel
  source: string
  preview?: RuntimeEventPreview
}

export type RuntimeEventInput = Omit<RuntimeEvent, 'id' | 'createdAt'>

export function withRuntimePreview(event: Omit<RuntimeEventInput, 'preview'>, preview?: RuntimeEventPreview): RuntimeEventInput {
  if (!preview) {
    return event
  }

  return {
    ...event,
    preview,
  }
}

type RuntimeSnapshot = {
  events: RuntimeEvent[]
}

type RuntimeState = RuntimeSnapshot & {
  addEvent: (event: RuntimeEventInput) => RuntimeEvent
  clearEvents: () => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSnapshot(): RuntimeSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { events: [] }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RuntimeSnapshot>
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
    }
  } catch {
    return { events: [] }
  }
}

function saveSnapshot(snapshot: RuntimeSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

const initialSnapshot = loadSnapshot()

export const useRuntimeStore = create<RuntimeState>((set) => ({
  ...initialSnapshot,
  addEvent: (event) => {
    const runtimeEvent: RuntimeEvent = {
      id: createId(),
      createdAt: Date.now(),
      ...event,
    }

    set((state) => {
      const nextState = {
        events: [runtimeEvent, ...state.events].slice(0, 150),
      }
      saveSnapshot(nextState)
      return nextState
    })

    return runtimeEvent
  },
  clearEvents: () => {
    const nextState = { events: [] }
    saveSnapshot(nextState)
    set(nextState)
  },
}))