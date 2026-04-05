import { create } from 'zustand'
import { queryEngine } from '../lib/query-engine'
import type { ProviderConnectionConfig } from '../lib/provider-config'

const STORAGE_KEY = 'silva-command-center-chat'

export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export type ChatSession = {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: ChatMessage[]
}

export type ProviderSummary = {
  id: string
  name: string
  available: boolean
  active: boolean
  models: string[]
  kind: 'local' | 'remote' | 'offline'
  status: 'active' | 'ready' | 'offline'
  detail: string
}

type AddMessageInput = {
  role: ChatRole
  content: string
}

type PersistedChatSnapshot = {
  sessions: ChatSession[]
  activeSessionId: string | null
}

type ChatState = {
  isReady: boolean
  isResponding: boolean
  sessions: ChatSession[]
  activeSessionId: string | null
  messages: ChatMessage[]
  providers: ProviderSummary[]
  activeProviderId: string | null
  initStore: () => void
  createSession: () => string
  selectSession: (id: string) => void
  renameSession: (id: string, title: string) => void
  addMessage: (message: AddMessageInput) => void
  sendMessage: (content: string) => Promise<void>
  refreshProviders: () => void
  probeProviders: () => Promise<void>
  connectProvider: (id: string, config: ProviderConnectionConfig) => Promise<{ ok: boolean; message: string }>
  disconnectProvider: (id: string, removeConfig?: boolean) => Promise<{ ok: boolean; message: string }>
  getProviderConfig: (id: string) => ProviderConnectionConfig | null
  setActiveProvider: (id: string) => void
  clearMessages: () => void
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createMessage(message: AddMessageInput): ChatMessage {
  return {
    id: createId(),
    role: message.role,
    content: message.content,
    createdAt: Date.now(),
  }
}

function createSession(title = 'New chat'): ChatSession {
  const now = Date.now()
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  }
}

function createSessionTitle(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  if (!compact) {
    return 'New chat'
  }
  return compact.length > 42 ? `${compact.slice(0, 42).trimEnd()}...` : compact
}

function loadSnapshot(): PersistedChatSnapshot {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const initialSession = createSession()
    return {
      sessions: [initialSession],
      activeSessionId: initialSession.id,
    }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedChatSnapshot>
    const sessions = Array.isArray(parsed.sessions) && parsed.sessions.length > 0 ? parsed.sessions : [createSession()]
    const activeSessionId = sessions.some((session) => session.id === parsed.activeSessionId) ? parsed.activeSessionId ?? sessions[0].id : sessions[0].id
    return { sessions, activeSessionId }
  } catch {
    const initialSession = createSession()
    return {
      sessions: [initialSession],
      activeSessionId: initialSession.id,
    }
  }
}

function saveSnapshot(snapshot: PersistedChatSnapshot) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
}

function getActiveMessages(sessions: ChatSession[], activeSessionId: string | null) {
  return sessions.find((session) => session.id === activeSessionId)?.messages ?? []
}

function applyChatSnapshot(snapshot: PersistedChatSnapshot) {
  saveSnapshot(snapshot)
  return {
    ...snapshot,
    messages: getActiveMessages(snapshot.sessions, snapshot.activeSessionId),
  }
}

async function progressivelyRenderAssistantResponse(
  set: Parameters<typeof create<ChatState>>[0],
  sessionId: string,
  messageId: string,
  response: string,
) {
  const chunkSize = Math.max(24, Math.ceil(response.length / 18))
  for (let index = chunkSize; index < response.length; index += chunkSize) {
    const partial = response.slice(0, index)
    set((state) => {
      const sessions = state.sessions.map((session) => {
        if (session.id !== sessionId) {
          return session
        }

        return {
          ...session,
          updatedAt: Date.now(),
          messages: session.messages.map((message) => (message.id === messageId ? { ...message, content: partial } : message)),
        }
      })

      return applyChatSnapshot({ sessions, activeSessionId: state.activeSessionId })
    })

    await new Promise((resolve) => window.setTimeout(resolve, 18))
  }
}

const initialSnapshot = loadSnapshot()

export const useChatStore = create<ChatState>((set, get) => ({
  isReady: false,
  isResponding: false,
  sessions: initialSnapshot.sessions,
  activeSessionId: initialSnapshot.activeSessionId,
  messages: getActiveMessages(initialSnapshot.sessions, initialSnapshot.activeSessionId),
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
  createSession: () => {
    const nextSession = createSession()
    set((state) => {
      const snapshot = {
        sessions: [nextSession, ...state.sessions],
        activeSessionId: nextSession.id,
      }
      return applyChatSnapshot(snapshot)
    })
    return nextSession.id
  },
  selectSession: (id) => {
    set((state) => {
      if (!state.sessions.some((session) => session.id === id)) {
        return state
      }

      return applyChatSnapshot({
        sessions: state.sessions,
        activeSessionId: id,
      })
    })
  },
  renameSession: (id, title) => {
    const trimmed = title.trim()
    if (!trimmed) {
      return
    }

    set((state) => {
      const sessions = state.sessions.map((session) => (session.id === id ? { ...session, title: trimmed, updatedAt: Date.now() } : session))
      return applyChatSnapshot({ sessions, activeSessionId: state.activeSessionId })
    })
  },
  addMessage: (message) => {
    set((state) => ({
      ...applyChatSnapshot({
        sessions: state.sessions.map((session) => (
          session.id === state.activeSessionId
            ? {
                ...session,
                updatedAt: Date.now(),
                title: session.messages.length === 0 && message.role === 'user' ? createSessionTitle(message.content) : session.title,
                messages: [...session.messages, createMessage(message)],
              }
            : session
        )),
        activeSessionId: state.activeSessionId,
      }),
    }))
  },
  sendMessage: async (content) => {
    const trimmed = content.trim()
    if (!trimmed) {
      return
    }

    const state = get()
    const targetSessionId = state.activeSessionId || state.createSession()

    const userMessage = createMessage({ role: 'user', content: trimmed })

    set((state) => ({
      ...applyChatSnapshot({
        sessions: state.sessions.map((session) => (
          session.id === targetSessionId
            ? {
                ...session,
                updatedAt: Date.now(),
                title: session.messages.length === 0 ? createSessionTitle(trimmed) : session.title,
                messages: [...session.messages, userMessage],
              }
            : session
        )),
        activeSessionId: targetSessionId,
      }),
      isResponding: true,
    }))

    try {
      const sessionMessages = get().sessions.find((session) => session.id === targetSessionId)?.messages ?? []
      const messages = sessionMessages.map((message) => ({ role: message.role, content: message.content }))

      const response = await queryEngine.complete(messages)
      const assistantMessage = createMessage({ role: 'assistant', content: '' })

      set((state) => ({
        ...applyChatSnapshot({
          sessions: state.sessions.map((session) => (
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  messages: [...session.messages, assistantMessage],
                }
              : session
          )),
          activeSessionId: state.activeSessionId,
        }),
      }))

      await progressivelyRenderAssistantResponse(set, targetSessionId, assistantMessage.id, response)

      set((state) => ({
        ...applyChatSnapshot({
          sessions: state.sessions.map((session) => (
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  messages: session.messages.map((message) => (message.id === assistantMessage.id ? { ...message, content: response } : message)),
                }
              : session
          )),
          activeSessionId: state.activeSessionId,
        }),
        isResponding: false,
        providers: queryEngine.getProviders(),
        activeProviderId: queryEngine.getActiveProvider()?.id || null,
      }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown assistant error'
      set((state) => ({
        ...applyChatSnapshot({
          sessions: state.sessions.map((session) => (
            session.id === targetSessionId
              ? {
                  ...session,
                  updatedAt: Date.now(),
                  messages: [...session.messages, createMessage({ role: 'assistant', content: `Assistant error: ${message}` })],
                }
              : session
          )),
          activeSessionId: state.activeSessionId,
        }),
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
  probeProviders: async () => {
    await queryEngine.reprobeProviders(() => {
      set({
        providers: queryEngine.getProviders(),
        activeProviderId: queryEngine.getActiveProvider()?.id || null,
      })
    })
  },
  connectProvider: async (id, config) => {
    const result = await queryEngine.connectProvider(id, config)
    set({
      providers: queryEngine.getProviders(),
      activeProviderId: queryEngine.getActiveProvider()?.id || null,
    })
    if (result.ok) {
      localStorage.setItem('silva-openai-config', JSON.stringify({
        baseUrl: config.baseUrl || 'https://api.openai.com/v1',
        apiKey: config.apiKey,
        model: config.model || 'gpt-4o-mini',
      }))
    }
    return result
  },
  disconnectProvider: async (id, removeConfig = false) => {
    const result = await queryEngine.disconnectProvider(id, removeConfig)
    set({
      providers: queryEngine.getProviders(),
      activeProviderId: queryEngine.getActiveProvider()?.id || null,
    })
    return result
  },
  getProviderConfig: (id) => queryEngine.getProviderConfig(id),
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
    set((state) => {
      const sessions = state.sessions.map((session) => (
        session.id === state.activeSessionId
          ? { ...session, title: 'New chat', updatedAt: Date.now(), messages: [] }
          : session
      ))
      return applyChatSnapshot({ sessions, activeSessionId: state.activeSessionId })
    })
  },
}))
