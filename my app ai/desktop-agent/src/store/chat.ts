import { create } from 'zustand'
import { queryEngine } from '../lib/query-engine'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type ProviderSummary = {
  id: string
  name: string
  available: boolean
  active: boolean
  models: string[]
}

type AddMessageInput = {
  role: ChatRole
  content: string
}

type ChatState = {
  isReady: boolean
  isResponding: boolean
  messages: ChatMessage[]
  providers: ProviderSummary[]
  activeProviderId: string | null
  initStore: () => void
  addMessage: (message: AddMessageInput) => void
  sendMessage: (content: string) => Promise<void>
  refreshProviders: () => void
  setActiveProvider: (id: string) => void
  clearMessages: () => void
}

function createMessage(message: AddMessageInput): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: message.role,
    content: message.content,
    createdAt: Date.now(),
  }
}

export const useChatStore = create<ChatState>((set) => ({
  isReady: false,
  isResponding: false,
  messages: [],
  providers: [],
  activeProviderId: null,
  initStore: () => {
    const activeProvider = queryEngine.getActiveProvider()
    set({
      isReady: true,
      providers: queryEngine.getProviders(),
      activeProviderId: activeProvider?.id || null,
    })
  },
  addMessage: (message) => {
    set((state) => ({
      messages: [
        ...state.messages,
        createMessage(message),
      ],
    }))
  },
  sendMessage: async (content) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    const userMessage = createMessage({ role: 'user', content: trimmed })

    set((state) => ({
      messages: [...state.messages, userMessage],
      isResponding: true,
    }))

    try {
      const messages = useChatStore
        .getState()
        .messages
        .map((message) => ({ role: message.role, content: message.content }))

      const response = await queryEngine.complete(messages)

      set((state) => ({
        messages: [...state.messages, createMessage({ role: 'assistant', content: response })],
        isResponding: false,
        providers: queryEngine.getProviders(),
        activeProviderId: queryEngine.getActiveProvider()?.id || null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown assistant error'
      set((state) => ({
        messages: [
          ...state.messages,
          createMessage({ role: 'assistant', content: `Assistant error: ${message}` }),
        ],
        isResponding: false,
      }))
    }
  },
  refreshProviders: () => {
    set({
      providers: queryEngine.getProviders(),
      activeProviderId: queryEngine.getActiveProvider()?.id || null,
    })
  },
  setActiveProvider: (id) => {
    const success = queryEngine.selectProvider(id)
    if (!success) {
      return
    }

    set({
      providers: queryEngine.getProviders(),
      activeProviderId: queryEngine.getActiveProvider()?.id || null,
    })
  },
  clearMessages: () => {
    set({ messages: [] })
  },
}))
