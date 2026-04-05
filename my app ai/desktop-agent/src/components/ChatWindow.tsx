import { useEffect, useMemo, useRef, useState } from 'react'
import { useArtifactStore } from '../store/artifacts'
import { useChatStore } from '../store/chat'
import { useSettingsStore } from '../store/settings'
import { toChatArtifact } from '../types/research'
import type { WorkspacePanel } from '../types/workspace'

type ChatWindowProps = {
  onSubmitMessage: (content: string) => Promise<void>
  onArtifactCreated: (title: string, detail: string) => void
  onNavigate: (panel: WorkspacePanel) => void
}

const quickPrompts = [
  { label: 'Plan work', value: '/plan build a practical roadmap for this app' },
  { label: 'Summarize notes', value: '/summarize Paste rough notes here and condense them into action points.' },
  { label: 'Rewrite text', value: '/rewrite this app needs cleaner navigation and clearer features' },
  { label: 'Show status', value: '/status' },
]

const featureLinks: Array<{ panel: WorkspacePanel; icon: string; label: string; detail: string }> = [
  { panel: 'coding', icon: '</>', label: 'Code', detail: 'Open coding workspace for implementation and fixes.' },
  { panel: 'tasks', icon: '✓', label: 'Tasks', detail: 'Queue and monitor autonomous tasks with approvals.' },
  { panel: 'browser', icon: '🌐', label: 'Browser', detail: 'Open browser automation controls and research actions.' },
  { panel: 'computer', icon: '⌨', label: 'Computer', detail: 'Capture screen and control keyboard/mouse workflows.' },
  { panel: 'search', icon: '🔎', label: 'Search', detail: 'Search chats, tools, and workspace context quickly.' },
  { panel: 'memory', icon: '🧠', label: 'Memory', detail: 'Review and reuse saved memory and prior traces.' },
  { panel: 'artifacts', icon: '📦', label: 'Artifacts', detail: 'Open generated files, pages, and captured outputs.' },
  { panel: 'settings', icon: '⚙', label: 'Settings', detail: 'Adjust models, provider routing, and app controls.' },
]

export function ChatWindow({ onSubmitMessage, onArtifactCreated, onNavigate }: ChatWindowProps) {
  const [draft, setDraft] = useState('')
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const lastSpokenMessageIdRef = useRef<string | null>(null)
  const { messages, isReady, isResponding, activeProviderId, sessions, activeSessionId, createSession } = useChatStore()
  const { addArtifact, selectArtifact } = useArtifactStore()
  const { voice, setVoiceSetting } = useSettingsStore()
  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
  const SpeechRecognitionConstructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
  const localVoiceConfigured = Boolean(voice.whisperPath.trim() && voice.piperPath.trim())
  const voiceAvailable = localVoiceConfigured || Boolean(SpeechRecognitionConstructor) || 'speechSynthesis' in window
  const assistantStatus = voiceStatus || (isReady ? 'Local assistant is ready for new work.' : 'Initializing local assistant...')
  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) {
      return 'Morning'
    }
    if (hour < 18) {
      return 'Afternoon'
    }
    return 'Evening'
  }, [])

  const send = async () => {
    const text = draft.trim()
    if (!text) {
      return
    }
    await onSubmitMessage(text)
    setDraft('')
  }

  const handleQuickPrompt = (value: string) => {
    setDraft(value)
  }

  const handleNewChat = () => {
    createSession()
    setDraft('')
  }

  const handleVoiceToggle = () => {
    if (voice.engine === 'local-whisper-piper') {
      if (!localVoiceConfigured) {
        setVoiceStatus('Local mode selected, but Whisper/Piper paths are missing in Settings > Voice.')
        return
      }
      setVoiceStatus('Local Whisper/Piper mode is configured. Browser voice capture stays off in local mode.')
      return
    }

    if (!SpeechRecognitionConstructor) {
      setVoiceStatus('Voice input is not available in this runtime.')
      return
    }

    if (!voice.enabled) {
      setVoiceSetting('enabled', true)
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognitionConstructor()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onstart = () => {
      setIsListening(true)
      setVoiceStatus('Listening...')
    }
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .flatMap((result) => Array.from(result))
        .map((result) => result.transcript)
        .join(' ')
        .trim()

      if (transcript) {
        setDraft(transcript)
      }
    }
    recognition.onerror = (event) => {
      setVoiceStatus(`Voice input error: ${event.error}`)
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
      setVoiceStatus((current) => (current === 'Listening...' ? 'Voice input captured.' : current))
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const saveMessageArtifact = (role: 'system' | 'user' | 'assistant', content: string, createdAt: number) => {
    const artifact = toChatArtifact({ role, content, createdAt })
    addArtifact(artifact)
    selectArtifact(artifact.id)
    onArtifactCreated(artifact.title, `Saved ${role} message into artifacts.`)
  }

  useEffect(() => {
    if (!voice.enabled) {
      return
    }

    const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim())
    if (!lastAssistantMessage || lastSpokenMessageIdRef.current === lastAssistantMessage.id) {
      return
    }

    if (voice.engine === 'local-whisper-piper') {
      if (!voice.piperPath.trim() || !voice.piperModelPath.trim()) {
        setVoiceStatus('Local voice is enabled, but Piper path/model are missing in Settings > Voice.')
        return
      }
      void window.electronAPI.localVoiceTts({
        piperPath: voice.piperPath,
        modelPath: voice.piperModelPath,
        text: lastAssistantMessage.content,
      }).catch((error) => {
        setVoiceStatus(error instanceof Error ? error.message : 'Local Piper playback failed.')
      })
    } else if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(lastAssistantMessage.content)
      utterance.rate = 1
      utterance.pitch = 1
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    }

    lastSpokenMessageIdRef.current = lastAssistantMessage.id
  }, [messages, voice.enabled, voice.engine, voice.piperModelPath, voice.piperPath])

  useEffect(
    () => () => {
      recognitionRef.current?.stop()
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    },
    [],
  )

  return (
    <section className="flex h-full flex-col bg-white">
      <div className="flex-1 overflow-auto bg-[#fbf8f2] p-6">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
              <div className="flex flex-wrap items-center justify-center gap-2 text-center text-sm text-claude-secondary">
                <div className="rounded-full border border-claude-border bg-white px-4 py-1.5">Provider: {activeProviderId || 'Offline Assistant'}</div>
                <div className={`rounded-full px-4 py-1.5 ${voiceAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
                  {voiceAvailable ? `Voice ready (${voice.engine === 'local-whisper-piper' ? 'Local' : 'Browser'})` : 'Voice unavailable'}
                </div>
              </div>

              <div className="max-w-3xl text-center">
                <div className="text-4xl font-semibold tracking-tight text-[#384257]">{greeting}. Ready when you are.</div>
                <div className="mt-2 text-base text-claude-secondary">
                  Start a prompt, run a command, or open a workspace from the quick links below.
                </div>
              </div>

              <div className="w-full max-w-3xl rounded-[24px] border border-claude-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-left">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Session</div>
                    <div className="mt-1 text-base font-semibold text-claude-text">{activeSession?.title || 'New chat'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-secondary transition hover:bg-[#f4efe3] hover:text-claude-text"
                  >
                    New chat
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-[#f7f3ea] px-4 py-3 text-sm text-claude-secondary">
                  <div className="font-medium text-claude-text">{assistantStatus}</div>
                  <div className="mt-1">Use the main composer below or pick a workspace action.</div>
                </div>
              </div>

              <div className="w-full max-w-4xl">
                <div className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Workspace Links</div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {featureLinks.map((link) => (
                    <button
                      key={link.panel}
                      type="button"
                      onClick={() => onNavigate(link.panel)}
                      title={link.detail}
                      className="group rounded-2xl border border-claude-border bg-white px-3 py-3 text-left shadow-sm transition hover:border-claude-text hover:shadow"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#f7f3ea] text-xs font-semibold text-claude-text">{link.icon}</span>
                        <span className="text-sm font-semibold text-claude-text">{link.label}</span>
                      </div>
                      <div className="mt-2 text-xs text-claude-secondary group-hover:text-claude-text">{link.detail}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full max-w-3xl">
                <div className="mb-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Prompt Shortcuts</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      onClick={() => handleQuickPrompt(prompt.value)}
                      className="rounded-full border border-claude-border bg-transparent px-3 py-1.5 text-xs font-medium text-claude-secondary transition hover:border-claude-accent hover:text-claude-accent"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === 'user'
                    ? 'ml-auto max-w-3xl rounded-2xl bg-claude-text px-4 py-3 text-sm text-white shadow-sm'
                    : 'max-w-3xl rounded-2xl border border-claude-border bg-white px-4 py-3 text-sm text-claude-text shadow-sm'
                }
              >
                <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] opacity-60">
                  <span>{message.role}</span>
                  <button
                    type="button"
                    onClick={() => saveMessageArtifact(message.role, message.content, message.createdAt)}
                    className="rounded-full border border-current px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80 transition hover:opacity-100"
                  >
                    Save artifact
                  </button>
                </div>
                <div className="whitespace-pre-wrap leading-6">{message.content}</div>
              </article>
            ))
          )}

          {isResponding ? (
            <div className="max-w-3xl rounded-2xl border border-claude-border bg-white px-4 py-3 text-left text-sm text-claude-secondary shadow-sm">
              Assistant is thinking...
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-claude-border bg-white px-5 py-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-claude-secondary">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-claude-border bg-[#fbf8f2] px-3 py-1.5">
                {activeSession?.title || 'New chat'}
              </div>
              <div className="rounded-full border border-claude-border bg-white px-3 py-1.5">
                {assistantStatus}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>{voice.enabled ? 'Voice output on' : 'Voice output off'}</span>
              <button
                type="button"
                onClick={() => setVoiceSetting('enabled', !voice.enabled)}
                className="rounded-full border border-claude-border px-3 py-1.5 font-medium text-claude-text transition hover:bg-[#f4efe3]"
              >
                {voice.enabled ? 'Disable voice' : 'Enable voice'}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-claude-border bg-claude-input p-2 shadow-sm">
            <div className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="max-h-40 min-h-[52px] flex-1 resize-y bg-transparent px-3 py-2 text-sm text-claude-text outline-none placeholder:text-claude-secondary"
                placeholder="Type a message or try /help"
              />
              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${isListening ? 'border-claude-text bg-claude-text text-white' : 'border-claude-border bg-white text-claude-secondary hover:border-claude-text hover:text-claude-text'}`}
                title="Voice input"
              >
                {isListening ? 'Listening...' : 'Voice'}
              </button>
              <button
                type="button"
                onClick={send}
                disabled={isResponding}
                className="rounded-2xl bg-claude-text px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResponding ? 'Working...' : 'Send'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-claude-secondary">
            <div>Quick commands: /help, /plan, /summarize, /rewrite, /status</div>
            <div>{messages.length} messages · {sessions.length} chats</div>
          </div>
        </div>
      </div>
    </section>
  )
}

type BrowserSpeechRecognitionResult = {
  transcript: string
}

type BrowserSpeechRecognitionEvent = {
  error: string
  results: ArrayLike<ArrayLike<BrowserSpeechRecognitionResult>>
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
