import { create } from 'zustand'

const STORAGE_KEY = 'silva-command-center-memory'

export type MemoryEntryKind = 'note' | 'artifact' | 'message' | 'runtime'

export type MemoryEntry = {
  id: string
  createdAt: number
  updatedAt: number
  kind: MemoryEntryKind
  title: string
  content: string
  sourceLabel: string
}

type MemorySnapshot = {
  entries: MemoryEntry[]
  selectedEntryId: string | null
}

type MemoryState = MemorySnapshot & {
  addEntry: (entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>) => MemoryEntry
  addNote: (title: string, content: string) => MemoryEntry
  selectEntry: (id: string | null) => void
  deleteEntry: (id: string) => void
  clearEntries: () => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function loadSnapshot(): MemorySnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { entries: [], selectedEntryId: null }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<MemorySnapshot>
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      selectedEntryId: typeof parsed.selectedEntryId === 'string' ? parsed.selectedEntryId : null,
    }
  } catch {
    return { entries: [], selectedEntryId: null }
  }
}

function saveSnapshot(snapshot: MemorySnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

const initialSnapshot = loadSnapshot()

export const useMemoryStore = create<MemoryState>((set) => ({
  ...initialSnapshot,
  addEntry: (entry) => {
    const nextEntry: MemoryEntry = {
      id: createId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...entry,
    }

    set((state) => {
      const nextState = {
        entries: [nextEntry, ...state.entries].slice(0, 200),
        selectedEntryId: nextEntry.id,
      }
      saveSnapshot(nextState)
      return nextState
    })

    return nextEntry
  },
  addNote: (title, content) => {
    const trimmedTitle = title.trim() || 'Untitled memory note'
    const trimmedContent = content.trim()
    const nextEntry: MemoryEntry = {
      id: createId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      kind: 'note',
      title: trimmedTitle,
      content: trimmedContent,
      sourceLabel: 'manual note',
    }

    set((state) => {
      const nextState = {
        entries: [nextEntry, ...state.entries].slice(0, 200),
        selectedEntryId: nextEntry.id,
      }
      saveSnapshot(nextState)
      return nextState
    })

    return nextEntry
  },
  selectEntry: (id) => {
    set((state) => {
      const nextState = {
        entries: state.entries,
        selectedEntryId: id,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  deleteEntry: (id) => {
    set((state) => {
      const nextEntries = state.entries.filter((entry) => entry.id !== id)
      const nextState = {
        entries: nextEntries,
        selectedEntryId: state.selectedEntryId === id ? nextEntries[0]?.id ?? null : state.selectedEntryId,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  clearEntries: () => {
    const nextState = { entries: [], selectedEntryId: null }
    saveSnapshot(nextState)
    set(nextState)
  },
}))