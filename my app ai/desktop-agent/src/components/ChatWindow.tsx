import { useState } from 'react'
import { useChatStore } from '../store/chat'

export function ChatWindow() {
  const [draft, setDraft] = useState('')
  const { messages, addMessage, isReady } = useChatStore()

  const send = () => {
    const text = draft.trim()
    if (!text) {
      return
    }
    addMessage({ role: 'user', content: text })
    setDraft('')
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex-1 overflow-auto p-4">
        <div className="mb-2 text-xs opacity-70">Session: {isReady ? 'ready' : 'initializing'}</div>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-sm opacity-70">No messages yet.</div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="rounded border border-gray-700 p-2 text-sm">
                <strong>{message.role}:</strong> {message.content}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-gray-700 p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="flex-1 rounded border border-gray-600 bg-transparent px-3 py-2 text-sm"
          placeholder="Type a message..."
        />
        <button type="button" onClick={send} className="rounded border border-gray-600 px-3 py-2 text-sm">
          Send
        </button>
      </div>
    </section>
  )
}
