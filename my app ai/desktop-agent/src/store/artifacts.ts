import { create } from 'zustand'
import type { ArtifactRecord, ResearchArtifact } from '../types/research'

const STORAGE_KEY = 'silva-command-center-artifacts'

type PersistedArtifacts = {
  artifacts: ArtifactRecord[]
  selectedArtifactId: string | null
}

type ArtifactState = PersistedArtifacts & {
  addArtifact: (artifact: ArtifactRecord) => void
  addResearchArtifact: (artifact: ResearchArtifact) => void
  selectArtifact: (id: string | null) => void
  clearArtifacts: () => void
}

function loadSnapshot(): PersistedArtifacts {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return { artifacts: [], selectedArtifactId: null }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedArtifacts>
    return {
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
      selectedArtifactId: typeof parsed.selectedArtifactId === 'string' ? parsed.selectedArtifactId : null,
    }
  } catch {
    return { artifacts: [], selectedArtifactId: null }
  }
}

function saveSnapshot(snapshot: PersistedArtifacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

const initialSnapshot = loadSnapshot()

export const useArtifactStore = create<ArtifactState>((set) => ({
  ...initialSnapshot,
  addArtifact: (artifact) => {
    set((state) => {
      const nextArtifacts = [artifact, ...state.artifacts]
      const nextState = {
        artifacts: nextArtifacts,
        selectedArtifactId: artifact.id,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  addResearchArtifact: (artifact) => {
    set((state) => {
      const nextArtifacts = [artifact, ...state.artifacts]
      const nextState = {
        artifacts: nextArtifacts,
        selectedArtifactId: artifact.id,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  selectArtifact: (id) => {
    set((state) => {
      const nextState = {
        artifacts: state.artifacts,
        selectedArtifactId: id,
      }
      saveSnapshot(nextState)
      return nextState
    })
  },
  clearArtifacts: () => {
    const nextState = { artifacts: [], selectedArtifactId: null }
    saveSnapshot(nextState)
    set(nextState)
  },
}))