import { create } from 'zustand'

type SearchRequest = {
  query: string
  autoRun: boolean
  requestedAt: number
}

type SearchState = {
  pendingRequest: SearchRequest | null
  requestSearch: (query: string, autoRun?: boolean) => void
  clearPendingRequest: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  pendingRequest: null,
  requestSearch: (query, autoRun = true) => {
    const trimmed = query.trim()
    if (!trimmed) {
      return
    }

    set({
      pendingRequest: {
        query: trimmed,
        autoRun,
        requestedAt: Date.now(),
      },
    })
  },
  clearPendingRequest: () => set({ pendingRequest: null }),
}))
