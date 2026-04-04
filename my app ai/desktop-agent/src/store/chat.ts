import { create } from 'zustand'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

type AddMessageInput = {
  role: ChatRole
  content: string
}

type ChatState = {
  isReady: boolean
  messages: ChatMessage[]
  initStore: () => void
  addMessage: (message: AddMessageInput) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  isReady: false,
  messages: [],
  initStore: () => {
    set({ isReady: true })
  },
  addMessage: (message) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          role: message.role,
          content: message.content,
        },
      ],
    }))
  },
  clearMessages: () => {
    set({ messages: [] })
  },
}))
