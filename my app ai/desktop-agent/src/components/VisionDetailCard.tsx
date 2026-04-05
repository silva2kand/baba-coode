import { useState } from 'react'
import { useMemoryStore } from '../store/memory'

type VisionEntities = {
  emails: string[]
  urls: string[]
  phones: string[]
  dates: string[]
}

type VisionDetailCardProps = {
  summaryLines: string[]
  actionItems: string[]
  entities: VisionEntities
  extractedText: string
  compact?: boolean
  onUsePrompt?: (prompt: string) => void
  memoryTitle?: string
  memorySourceLabel?: string
}

async function copyText(value: string) {
  if (!value || typeof navigator === 'undefined' || !navigator.clipboard) {
    return false
  }

  await navigator.clipboard.writeText(value)
  return true
}

async function openExternal(value: string) {
  if (!value) {
    return false
  }

  if (typeof window !== 'undefined' && window.electronAPI?.openExternal) {
    await window.electronAPI.openExternal(value)
    return true
  }

  if (typeof window !== 'undefined') {
    window.open(value, '_blank', 'noopener,noreferrer')
    return true
  }

  return false
}

function EntityRow({
  label,
  values,
  compact,
  onUsePrompt,
  onSaveMemory,
}: {
  label: string
  values: string[]
  compact: boolean
  onUsePrompt?: (prompt: string) => void
  onSaveMemory: (section: string, value: string) => void
}) {
  const [copied, setCopied] = useState(false)

  if (values.length === 0) {
    return null
  }

  const handleCopy = async () => {
    const ok = await copyText(values.join('\n'))
    if (!ok) {
      return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  const handleOpen = (value: string) => {
    if (typeof window === 'undefined') {
      return
    }

    if (label === 'URLs') {
      void openExternal(value)
      return
    }

    if (label === 'Emails') {
      void openExternal(`mailto:${value}`)
      return
    }

    if (label === 'Phones') {
      void openExternal(`tel:${value.replace(/\s+/g, '')}`)
      return
    }
  }

  const canOpen = label === 'URLs' || label === 'Emails' || label === 'Phones'

  return (
    <div className="rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">{label}</div>
        {!compact ? (
          <div className="flex items-center gap-2">
            {onUsePrompt ? (
              <button
                type="button"
                onClick={() => onUsePrompt(`Use these ${label.toLowerCase()} from the vision result:\n\n${values.join('\n')}`)}
                className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
              >
                Chat
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onSaveMemory(label, values.join('\n'))}
              className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
            >
              Memory
            </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          canOpen ? (
            <button
              key={value}
              type="button"
              onClick={() => handleOpen(value)}
              className="rounded-full border border-claude-border bg-white px-2.5 py-1 text-left text-xs text-claude-text transition hover:bg-stone-100"
            >
              {value}
            </button>
          ) : (
            <button
              key={value}
              type="button"
              onClick={() => void copyText(value)}
              className="rounded-full border border-claude-border bg-white px-2.5 py-1 text-left text-xs text-claude-text transition hover:bg-stone-100"
            >
              {value}
            </button>
          )
        ))}
      </div>
    </div>
  )
}

export function VisionDetailCard({
  summaryLines,
  actionItems,
  entities,
  extractedText,
  compact = false,
  onUsePrompt,
  memoryTitle = 'Vision capture',
  memorySourceLabel = 'vision workspace',
}: VisionDetailCardProps) {
  const [copiedText, setCopiedText] = useState(false)
  const [savedMemory, setSavedMemory] = useState<string | null>(null)
  const addEntry = useMemoryStore((state) => state.addEntry)

  const handleSaveMemory = (section: string, content: string) => {
    if (!content.trim()) {
      return
    }

    addEntry({
      kind: 'artifact',
      title: `${memoryTitle} · ${section}`,
      content,
      sourceLabel: memorySourceLabel,
    })
    setSavedMemory(section)
    window.setTimeout(() => setSavedMemory(null), 1200)
  }

  const handleCopyText = async () => {
    const ok = await copyText(extractedText)
    if (!ok) {
      return
    }
    setCopiedText(true)
    window.setTimeout(() => setCopiedText(false), 1200)
  }

  return (
    <div className="space-y-3">
      {summaryLines.length > 0 ? (
        <div className="rounded-2xl bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Vision summary</div>
            {!compact ? (
              <div className="flex items-center gap-2">
                {onUsePrompt ? (
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Use this vision summary as working context:\n\n${summaryLines.join('\n')}`)}
                    className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                  >
                    Chat
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleSaveMemory('summary', summaryLines.join('\n'))}
                  className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                >
                  {savedMemory === 'summary' ? 'Saved' : 'Memory'}
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-2 space-y-1 text-sm text-claude-text">
            {summaryLines.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      ) : null}

      {actionItems.length > 0 ? (
        <div className="rounded-2xl bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Action items</div>
            {!compact ? (
              <div className="flex items-center gap-2">
                {onUsePrompt ? (
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Use these action items from the vision result:\n\n${actionItems.join('\n')}`)}
                    className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                  >
                    Chat
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleSaveMemory('action items', actionItems.join('\n'))}
                  className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                >
                  {savedMemory === 'action items' ? 'Saved' : 'Memory'}
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-2 space-y-1 text-sm text-claude-text">
            {actionItems.map((line) => <div key={line}>{line}</div>)}
          </div>
        </div>
      ) : null}

      <EntityRow label="Emails" values={entities.emails} compact={compact} onUsePrompt={onUsePrompt} onSaveMemory={handleSaveMemory} />
      <EntityRow label="URLs" values={entities.urls} compact={compact} onUsePrompt={onUsePrompt} onSaveMemory={handleSaveMemory} />
      <EntityRow label="Phones" values={entities.phones} compact={compact} onUsePrompt={onUsePrompt} onSaveMemory={handleSaveMemory} />
      <EntityRow label="Dates" values={entities.dates} compact={compact} onUsePrompt={onUsePrompt} onSaveMemory={handleSaveMemory} />

      {extractedText ? (
        <div className="rounded-2xl bg-stone-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-claude-secondary">Extracted text</div>
            {!compact ? (
              <div className="flex items-center gap-2">
                {onUsePrompt ? (
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Use this extracted OCR text as working context:\n\n${extractedText}`)}
                    className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                  >
                    Chat
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => handleSaveMemory('extracted text', extractedText)}
                  className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                >
                  {savedMemory === 'extracted text' ? 'Saved' : 'Memory'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyText()}
                  className="rounded-full border border-claude-border px-2 py-1 text-[10px] font-medium text-claude-text"
                >
                  {copiedText ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : null}
          </div>
          <div className={`${compact ? 'max-h-28' : 'max-h-52'} mt-2 overflow-auto whitespace-pre-wrap text-sm leading-6 text-claude-text`}>
            {extractedText}
          </div>
        </div>
      ) : null}
    </div>
  )
}