export type ResearchCommandRequest = {
  inputText: string
  model?: string
  denyTools?: string[]
  denyPrefixes?: string[]
}

export type ResearchPermissionDenial = {
  tool_name: string
  reason: string
}

export type ResearchSource = {
  input_text: string
  input_kind: string
  query: string | null
  resolved_url: string
  title: string
  preview: string
  fetched_chars: number
}

export type ResearchSynthesis = {
  summary: string
  key_points: string[]
  risks: string[]
  follow_up: string[]
}

export type ResearchCommandResult = {
  ok: boolean
  source: ResearchSource
  synthesis: ResearchSynthesis | null
  provider: string | null
  model: string | null
  permission_denials: ResearchPermissionDenial[]
  error: string | null
  artifact_kind: string
  artifact_title: string
  chat_prompt: string
}

type ArtifactBase = {
  id: string
  createdAt: number
  title: string
  chatPrompt: string
}

export type ResearchArtifact = ArtifactBase & {
  kind: 'research'
  sourceInput: string
  sourceKind: string
  query: string | null
  sourceUrl: string
  sourceTitle: string
  preview: string
  fetchedChars: number
  summary: string
  keyPoints: string[]
  risks: string[]
  followUp: string[]
  provider: string | null
  model: string | null
}

export type SavedFileArtifact = ArtifactBase & {
  kind: 'file'
  path: string
  size: number
  content: string
  truncated: boolean
}

export type SavedWebArtifact = ArtifactBase & {
  kind: 'web'
  url: string
  ok: boolean
  status: number
  contentType: string
  preview: string
}

export type SavedMediaArtifact = ArtifactBase & {
  kind: 'media'
  name: string
  mimeType: string
  size: number
  sourceType: 'image' | 'document'
  previewDataUrl: string | null
  previewText: string
  extractedText: string
  summaryLines: string[]
  actionItems: string[]
  entities: {
    emails: string[]
    urls: string[]
    phones: string[]
    dates: string[]
  }
  truncated: boolean
}

export type SavedChatArtifact = ArtifactBase & {
  kind: 'chat'
  role: 'system' | 'user' | 'assistant'
  content: string
  messageCreatedAt: number
}

export type ArtifactRecord = ResearchArtifact | SavedFileArtifact | SavedWebArtifact | SavedMediaArtifact | SavedChatArtifact

export type FileReadArtifactInput = {
  path: string
  size: number
  content: string
  truncated: boolean
}

export type WebFetchArtifactInput = {
  url: string
  ok: boolean
  status: number
  contentType: string
  title: string
  preview: string
}

export type MediaArtifactInput = {
  name: string
  mimeType: string
  size: number
  sourceType: 'image' | 'document'
  previewDataUrl: string | null
  previewText: string
  extractedText: string
  summaryLines: string[]
  actionItems: string[]
  entities: {
    emails: string[]
    urls: string[]
    phones: string[]
    dates: string[]
  }
  truncated: boolean
}

export type ChatArtifactInput = {
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: number
}

function createArtifactId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function toResearchArtifact(result: ResearchCommandResult): ResearchArtifact {
  if (!result.synthesis) {
    throw new Error('Cannot create a research artifact from an empty synthesis result.')
  }

  return {
    id: createArtifactId(),
    kind: 'research',
    createdAt: Date.now(),
    title: result.artifact_title || result.source.title || result.source.input_text,
    sourceInput: result.source.input_text,
    sourceKind: result.source.input_kind,
    query: result.source.query,
    sourceUrl: result.source.resolved_url,
    sourceTitle: result.source.title,
    preview: result.source.preview,
    fetchedChars: result.source.fetched_chars,
    summary: result.synthesis.summary,
    keyPoints: result.synthesis.key_points,
    risks: result.synthesis.risks,
    followUp: result.synthesis.follow_up,
    provider: result.provider,
    model: result.model,
    chatPrompt: result.chat_prompt,
  }
}

export function toFileArtifact(result: FileReadArtifactInput): SavedFileArtifact {
  return {
    id: createArtifactId(),
    kind: 'file',
    createdAt: Date.now(),
    title: result.path.split(/[/\\]/).pop() || result.path,
    path: result.path,
    size: result.size,
    content: result.content,
    truncated: result.truncated,
    chatPrompt: `Use this file artifact in the current conversation.\n\nPath: ${result.path}\nSize: ${result.size} bytes\n\n${result.content}`,
  }
}

export function toWebArtifact(result: WebFetchArtifactInput): SavedWebArtifact {
  const title = result.title || result.url
  return {
    id: createArtifactId(),
    kind: 'web',
    createdAt: Date.now(),
    title,
    url: result.url,
    ok: result.ok,
    status: result.status,
    contentType: result.contentType,
    preview: result.preview,
    chatPrompt: `Use this web artifact in the current conversation.\n\nURL: ${result.url}\nTitle: ${title}\nStatus: ${result.status}\nContent-Type: ${result.contentType}\n\n${result.preview}`,
  }
}

export function toMediaArtifact(result: MediaArtifactInput): SavedMediaArtifact {
  return {
    id: createArtifactId(),
    kind: 'media',
    createdAt: Date.now(),
    title: result.name,
    name: result.name,
    mimeType: result.mimeType,
    size: result.size,
    sourceType: result.sourceType,
    previewDataUrl: result.previewDataUrl,
    previewText: result.previewText,
    extractedText: result.extractedText,
    summaryLines: result.summaryLines,
    actionItems: result.actionItems,
    entities: result.entities,
    truncated: result.truncated,
    chatPrompt: `Use this media artifact in the current conversation.\n\nName: ${result.name}\nType: ${result.mimeType || 'unknown'}\nSize: ${result.size} bytes\nSource: ${result.sourceType}\n\n${result.previewText}`,
  }
}

export function toChatArtifact(result: ChatArtifactInput): SavedChatArtifact {
  const normalized = result.content.trim() || '(empty message)'
  const title = `${result.role} message · ${normalized.slice(0, 56)}`
  return {
    id: createArtifactId(),
    kind: 'chat',
    createdAt: Date.now(),
    title,
    role: result.role,
    content: normalized,
    messageCreatedAt: result.createdAt,
    chatPrompt: `Use this saved chat artifact in the current conversation.\n\nRole: ${result.role}\nCreated: ${new Date(result.createdAt).toLocaleString()}\n\n${normalized}`,
  }
}