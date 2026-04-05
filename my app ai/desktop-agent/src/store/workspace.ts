import { create } from 'zustand'
import type { SurfaceIntent, WorkspacePreviewFocus } from '../types/workspace'

const STORAGE_KEY = 'silva-command-center-workspace-session'

type PersistedWorkspaceSession = {
  activeIntent: SurfaceIntent | null
  previewFocus: WorkspacePreviewFocus | null
}

type SurfaceIntentInput = Omit<SurfaceIntent, 'id' | 'createdAt'>
type PreviewFocusInput = Omit<WorkspacePreviewFocus, 'id' | 'createdAt'>

type WorkspaceSessionState = PersistedWorkspaceSession & {
  setActiveIntent: (intent: SurfaceIntentInput | null) => void
  setPreviewFocus: (focus: PreviewFocusInput | null) => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSnapshot(): PersistedWorkspaceSession {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { activeIntent: null, previewFocus: null }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceSession>
    return {
      activeIntent: parsed.activeIntent ?? null,
      previewFocus: parsed.previewFocus ?? null,
    }
  } catch {
    return { activeIntent: null, previewFocus: null }
  }
}

function saveSnapshot(snapshot: PersistedWorkspaceSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

const initialSnapshot = loadSnapshot()

export const useWorkspaceStore = create<WorkspaceSessionState>((set) => ({
  ...initialSnapshot,
  setActiveIntent: (intent) => {
    set((state) => {
      const nextState = {
        ...state,
        activeIntent: intent
          ? {
              id: createId(),
              createdAt: Date.now(),
              ...intent,
            }
          : null,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  setPreviewFocus: (focus) => {
    set((state) => {
      const nextState = {
        ...state,
        previewFocus: focus
          ? {
              id: createId(),
              createdAt: Date.now(),
              ...focus,
            }
          : null,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
}))