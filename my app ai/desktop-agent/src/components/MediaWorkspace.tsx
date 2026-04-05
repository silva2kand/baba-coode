import { useEffect, useState } from 'react'
import { VisionDetailCard } from './VisionDetailCard'
import { analyzeVisionText, formatVisionPreview } from '../lib/vision-analysis'
import { useArtifactStore } from '../store/artifacts'
import type { RuntimeEventInput } from '../store/runtime'
import { toMediaArtifact, type MediaArtifactInput } from '../types/research'

type MediaWorkspaceProps = {
  onUsePrompt: (prompt: string) => void
  onRuntimeEvent: (event: RuntimeEventInput) => void
  onArtifactCreated: (title: string, detail: string) => void
}

export function MediaWorkspace({ onUsePrompt, onRuntimeEvent, onArtifactCreated }: MediaWorkspaceProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [artifactDraft, setArtifactDraft] = useState<MediaArtifactInput | null>(null)
  const [isPreparing, setIsPreparing] = useState(false)
  const { addArtifact, selectArtifact } = useArtifactStore()

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleSelect = async (file: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setSelectedFile(file)
    setPreviewUrl(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    setArtifactDraft(null)

    if (!file) {
      onRuntimeEvent({
        kind: 'tool',
        status: 'info',
        title: 'Media selection cleared',
        detail: 'No local media item is currently selected.',
        panel: 'console',
        source: 'media-workspace',
        preview: {
          title: 'Vision selection cleared',
          body: 'No local media item is currently selected.',
          metadata: ['Waiting for media input'],
          mode: 'media',
        },
      })
      return
    }

    setIsPreparing(true)
    try {
      onRuntimeEvent({
        kind: 'tool',
        status: 'running',
        title: 'Preparing vision input',
        detail: `${file.name}\n${file.type || 'unknown'}\nRunning local preview preparation${file.type.startsWith('image/') ? ' and OCR extraction' : ''}.`,
        panel: 'images',
        source: 'media-workspace',
        preview: {
          title: file.name,
          body: `${file.type || 'unknown'}\nPreparing media preview${file.type.startsWith('image/') ? ' and OCR extraction.' : '.'}`,
          metadata: [`${file.size.toLocaleString()} bytes`],
          mode: 'media',
        },
      })

      const nextDraft = await buildMediaArtifactInput(file)
      setArtifactDraft(nextDraft)
      onRuntimeEvent({
        kind: 'tool',
        status: 'success',
        title: 'Prepared media input',
        detail: `${file.name}\n${file.type || 'unknown'}\n${file.size.toLocaleString()} bytes${nextDraft.extractedText ? '\nOCR text extracted.' : ''}`,
        panel: 'images',
        source: 'media-workspace',
        preview: {
          title: file.name,
          body: nextDraft.previewText || nextDraft.extractedText || 'Media asset prepared.',
          metadata: [file.type || 'unknown', `${file.size.toLocaleString()} bytes`, nextDraft.sourceType],
          mode: 'media',
        },
      })
    } catch (error) {
      onRuntimeEvent({
        kind: 'tool',
        status: 'error',
        title: 'Vision preparation failed',
        detail: error instanceof Error ? error.message : 'Unable to prepare media input.',
        panel: 'console',
        source: 'media-workspace',
        preview: {
          title: 'Vision preparation failed',
          body: error instanceof Error ? error.message : 'Unable to prepare media input.',
          metadata: [file.name],
          mode: 'media',
        },
      })
    } finally {
      setIsPreparing(false)
    }
  }

  const saveArtifact = () => {
    if (!artifactDraft) {
      return
    }

    const artifact = toMediaArtifact(artifactDraft)
    addArtifact(artifact)
    selectArtifact(artifact.id)
    onArtifactCreated(artifact.title, `Saved ${artifact.sourceType} artifact from local media intake.\n\n${artifact.previewText}`)
  }

  return (
    <section className="h-full overflow-auto bg-stone-50/70 p-5">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <div className="rounded-3xl border border-claude-border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-claude-secondary">
            <span>Vision workspace</span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Live</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-claude-text">Vision and multimodal intake for images, screenshots, and documents</h2>
          <p className="mt-2 max-w-3xl text-sm text-claude-secondary">
            Drop in an image, screenshot, or document, inspect the local metadata, and pass the asset context into command chat. This gives Baba a dedicated in-window vision surface instead of a generic upload panel.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Asset intake</div>
            <label className="mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-claude-border bg-stone-50 px-6 py-10 text-center text-sm text-claude-secondary">
              <input
                type="file"
                accept="image/*,.pdf,.txt,.md,.doc,.docx"
                onChange={(event) => void handleSelect(event.target.files?.[0] || null)}
                className="hidden"
              />
              <span className="font-medium text-claude-text">Choose image or document</span>
              <span className="mt-2">Supports images, PDF, text, markdown, and common office documents.</span>
            </label>

            {selectedFile ? (
              <div className="mt-4 rounded-2xl border border-claude-border bg-stone-50 p-4 text-sm text-claude-secondary">
                <div><span className="font-medium text-claude-text">Name:</span> {selectedFile.name}</div>
                <div className="mt-2"><span className="font-medium text-claude-text">Type:</span> {selectedFile.type || 'unknown'}</div>
                <div className="mt-2"><span className="font-medium text-claude-text">Size:</span> {selectedFile.size.toLocaleString()} bytes</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onUsePrompt(`Analyze this asset and propose next steps:\n\nName: ${selectedFile.name}\nType: ${selectedFile.type || 'unknown'}\nSize: ${selectedFile.size} bytes\n\n${artifactDraft?.previewText || ''}`)}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text"
                  >
                    Send asset context to chat
                  </button>
                  <button
                    type="button"
                    onClick={saveArtifact}
                    disabled={!artifactDraft || isPreparing}
                    className="rounded-full border border-claude-border px-3 py-1.5 text-xs font-medium text-claude-text disabled:opacity-50"
                  >
                    {isPreparing ? 'Preparing...' : 'Save artifact'}
                  </button>
                </div>
                {artifactDraft ? (
                  <div className="mt-4">
                    <VisionDetailCard
                      summaryLines={artifactDraft.summaryLines}
                      actionItems={artifactDraft.actionItems}
                      entities={artifactDraft.entities}
                      extractedText={artifactDraft.extractedText}
                      onUsePrompt={onUsePrompt}
                      memoryTitle={`Vision draft · ${selectedFile.name}`}
                      memorySourceLabel="vision workspace"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-claude-border bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-claude-secondary">Preview</div>
            <div className="mt-4 rounded-3xl border border-claude-border bg-stone-50 p-4">
              {previewUrl ? (
                <img src={previewUrl} alt={selectedFile?.name || 'Selected preview'} className="max-h-[32rem] w-full rounded-2xl object-contain" />
              ) : (
                <div className="flex min-h-72 items-center justify-center text-sm text-claude-secondary">
                  Select an image to preview it here. Non-image documents still surface metadata and can be pushed into chat.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}

async function buildMediaArtifactInput(file: File): Promise<MediaArtifactInput> {
  const isImage = file.type.startsWith('image/')
  const isTextLike = file.type.startsWith('text/') || /\.(txt|md|json|csv|log)$/i.test(file.name)
  const canInlineImage = isImage && file.size <= 1_500_000

  let previewDataUrl: string | null = null
  if (canInlineImage) {
    previewDataUrl = await readAsDataUrl(file)
  }

  if (isImage) {
    const extractedText = await extractTextFromImage(file)
    const analysis = analyzeVisionText(extractedText)
    const previewText = formatVisionPreview(
      analysis,
      previewDataUrl
        ? 'Local image selected and stored with inline preview. No readable OCR text was detected.'
        : 'Local image selected. Inline preview was skipped because the file is too large to persist safely in the artifact store, and no readable OCR text was detected.',
    )

    return {
      name: file.name,
      mimeType: file.type || 'unknown',
      size: file.size,
      sourceType: 'image',
      previewDataUrl,
      previewText,
      extractedText: analysis.extractedText,
      summaryLines: analysis.summaryLines,
      actionItems: analysis.actionItems,
      entities: analysis.entities,
      truncated: analysis.extractedText.length > 12000 || !previewDataUrl,
    }
  }

  if (isTextLike) {
    const content = await file.text()
    const previewText = content.slice(0, 12000)
    return {
      name: file.name,
      mimeType: file.type || 'text/plain',
      size: file.size,
      sourceType: 'document',
      previewDataUrl: null,
      previewText,
      extractedText: previewText,
      summaryLines: previewText.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 5),
      actionItems: [],
      entities: { emails: [], urls: [], phones: [], dates: [] },
      truncated: content.length > previewText.length,
    }
  }

  return {
    name: file.name,
    mimeType: file.type || 'unknown',
    size: file.size,
    sourceType: 'document',
    previewDataUrl: null,
    previewText: 'Binary document selected locally. Content preview is unavailable in the current build, but the file metadata can still be reused in chat and artifacts.',
    extractedText: '',
    summaryLines: [],
    actionItems: [],
    entities: { emails: [], urls: [], phones: [], dates: [] },
    truncated: false,
  }
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'))
    reader.readAsDataURL(file)
  })
}

async function extractTextFromImage(file: File) {
  const { recognize } = await import('tesseract.js')
  const result = await recognize(file, 'eng')
  return result.data.text || ''
}