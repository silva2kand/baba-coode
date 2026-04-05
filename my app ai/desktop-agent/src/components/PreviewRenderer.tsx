import type { ChatMessage } from '../store/chat'
import { VisionDetailCard } from './VisionDetailCard'
import type { RuntimeEvent } from '../store/runtime'
import type { ArtifactRecord } from '../types/research'
import type { WorkspacePanel, WorkspacePreviewFocus } from '../types/workspace'

type PreviewRendererProps = {
  activePanel: WorkspacePanel
  previewFocus: WorkspacePreviewFocus | null
  selectedArtifact: ArtifactRecord | null
  latestRuntimeEvent: RuntimeEvent | null
  latestMessage: ChatMessage | null
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString()
}

export function PreviewRenderer({ activePanel, previewFocus, selectedArtifact, latestRuntimeEvent, latestMessage }: PreviewRendererProps) {
  if (previewFocus) {
    return (
      <div className="space-y-3 text-sm text-claude-secondary">
        <div>
          <div className="font-medium text-claude-text">{previewFocus.title}</div>
          <div className="mt-1 text-xs capitalize">{previewFocus.panel} · {previewFocus.mode} · {formatTimestamp(previewFocus.createdAt)}</div>
        </div>
        <div className="max-h-56 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">{previewFocus.body}</div>
        {previewFocus.metadata.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {previewFocus.metadata.map((item) => (
              <span key={item} className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{item}</span>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  if (selectedArtifact) {
    if (selectedArtifact.kind === 'research') {
      return (
        <div className="space-y-3 text-sm text-claude-secondary">
          <div>
            <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
            <div className="mt-1 text-xs">{selectedArtifact.sourceUrl}</div>
          </div>
          <div className="rounded-2xl bg-stone-50 p-3 text-claude-text">{selectedArtifact.summary}</div>
          <div className="text-xs">Research preview · {selectedArtifact.keyPoints.length} key points</div>
        </div>
      )
    }

    if (selectedArtifact.kind === 'file') {
      return (
        <div className="space-y-3 text-sm text-claude-secondary">
          <div>
            <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
            <div className="mt-1 text-xs">{selectedArtifact.path}</div>
          </div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-xs text-claude-text">{selectedArtifact.content}</pre>
          <div className="text-xs">File preview · {selectedArtifact.size.toLocaleString()} bytes</div>
        </div>
      )
    }

    if (selectedArtifact.kind === 'web') {
      return (
        <div className="space-y-3 text-sm text-claude-secondary">
          <div>
            <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
            <div className="mt-1 text-xs">{selectedArtifact.url}</div>
          </div>
          <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">{selectedArtifact.preview}</div>
          <div className="text-xs">Web preview · {selectedArtifact.status} · {selectedArtifact.contentType}</div>
        </div>
      )
    }

    if (selectedArtifact.kind === 'media') {
      return (
        <div className="space-y-3 text-sm text-claude-secondary">
          <div>
            <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
            <div className="mt-1 text-xs">{selectedArtifact.mimeType || 'unknown'} · {selectedArtifact.size.toLocaleString()} bytes</div>
          </div>
          {selectedArtifact.previewDataUrl ? (
            <img src={selectedArtifact.previewDataUrl} alt={selectedArtifact.name} className="max-h-48 w-full rounded-2xl object-contain" />
          ) : null}
          <VisionDetailCard
            compact
            summaryLines={selectedArtifact.summaryLines}
            actionItems={selectedArtifact.actionItems}
            entities={selectedArtifact.entities}
            extractedText={selectedArtifact.extractedText}
          />
        </div>
      )
    }

    return (
      <div className="space-y-3 text-sm text-claude-secondary">
        <div>
          <div className="font-medium text-claude-text">{selectedArtifact.title}</div>
          <div className="mt-1 text-xs">{selectedArtifact.role} · {formatTimestamp(selectedArtifact.messageCreatedAt)}</div>
        </div>
        <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">{selectedArtifact.content}</div>
      </div>
    )
  }

  if (latestRuntimeEvent) {
    return (
      <div className="space-y-3 text-sm text-claude-secondary">
        <div>
          <div className="font-medium text-claude-text">{latestRuntimeEvent.title}</div>
          <div className="mt-1 text-xs">{latestRuntimeEvent.kind} · {latestRuntimeEvent.status} · {formatTimestamp(latestRuntimeEvent.createdAt)}</div>
        </div>
        <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">{latestRuntimeEvent.detail}</div>
      </div>
    )
  }

  if (latestMessage) {
    return (
      <div className="space-y-3 text-sm text-claude-secondary">
        <div>
          <div className="font-medium text-claude-text">Latest conversation preview</div>
          <div className="mt-1 text-xs">{latestMessage.role} · {formatTimestamp(latestMessage.createdAt)}</div>
        </div>
        <div className="max-h-48 overflow-auto whitespace-pre-wrap rounded-2xl bg-stone-50 p-3 text-sm text-claude-text">{latestMessage.content}</div>
      </div>
    )
  }

  return (
    <div className="text-sm text-claude-secondary">
      {activePanel === 'search'
        ? 'Research previews will appear here after the first result.'
        : activePanel === 'memory'
          ? 'Memory previews will surface saved artifacts, recent traces, and conversation history.'
        : activePanel === 'coding'
          ? 'Code previews and working context will appear here during coding mode.'
          : activePanel === 'images'
            ? 'Image and document previews will appear here during multimodal work.'
            : 'No preview available yet for the current surface.'}
    </div>
  )
}