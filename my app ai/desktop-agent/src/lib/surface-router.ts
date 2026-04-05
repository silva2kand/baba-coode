import type { WorkspacePanel, WorkspacePreviewFocus } from '../types/workspace'

export type SurfaceDecision = {
  panel: WorkspacePanel
  reason: string
  previewTitle: string
  previewBody: string
}

const codingPattern = /```|\b(fix|debug|refactor|implement|code|coding|function|class|component|typescript|javascript|python|bug|test|compile|tsc|pytest|stack trace|error|exception|diff|patch|repo|ipc|electron|react)\b|[a-zA-Z]:\\|\/(src|tests|electron)\/|\.(ts|tsx|js|jsx|py|json|md)\b/i
const researchPattern = /^https?:\/\/|\b(research|search the web|look up|find sources|summarize this page|url)\b/i
const visionPattern = /\b(image|vision|screenshot|photo|ocr|scan|extract text from image|analyze image|document image|multimodal)\b/i
const memoryPattern = /\b(memory|remember|history|recap|notes|previous context|working memory|stored context|what have we saved)\b/i

const routedCommands: Record<string, WorkspacePanel> = {
  '/artifacts': 'artifacts',
  '/business': 'business',
  '/chat': 'chat',
  '/code': 'coding',
  '/coding': 'coding',
  '/computer': 'computer',
  '/browser': 'browser',
  '/console': 'console',
  '/customize': 'customize',
  '/dispatch': 'dispatch',
  '/accounting': 'accounting',
  '/vision': 'images',
  '/images': 'images',
  '/legal': 'legal',
  '/memory': 'memory',
  '/projects': 'projects',
  '/reasoning': 'reasoning',
  '/research': 'search',
  '/search': 'search',
  '/settings': 'settings',
  '/tasks': 'tasks',
  '/tools': 'tools',
  '/run': 'console',
  '/model': 'console',
  '/status': 'console',
  '/help': 'console',
}

export function detectPromptSurface(input: string): SurfaceDecision | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  if (codingPattern.test(trimmed)) {
    return {
      panel: 'coding',
      reason: 'Detected code-oriented language, file paths, or debugging terms.',
      previewTitle: 'Coding route armed',
      previewBody: summarizeInput(trimmed),
    }
  }

  if (visionPattern.test(trimmed)) {
    return {
      panel: 'images',
      reason: 'Detected image, screenshot, OCR, or multimodal language.',
      previewTitle: 'Vision route armed',
      previewBody: summarizeInput(trimmed),
    }
  }

  if (memoryPattern.test(trimmed)) {
    return {
      panel: 'memory',
      reason: 'Detected memory, recap, or stored-context language.',
      previewTitle: 'Memory route armed',
      previewBody: summarizeInput(trimmed),
    }
  }

  if (researchPattern.test(trimmed)) {
    return {
      panel: 'search',
      reason: 'Detected research or URL-oriented input.',
      previewTitle: 'Research route armed',
      previewBody: summarizeInput(trimmed),
    }
  }

  return null
}

export function detectCommandSurface(input: string): SurfaceDecision | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed.startsWith('/')) {
    return null
  }

  const [command] = trimmed.split(/\s+/, 1)
  const panel = routedCommands[command] || 'console'
  return {
    panel,
    reason: `Command ${command} routes into the ${panel} surface.`,
    previewTitle: `Command route: ${command}`,
    previewBody: summarizeInput(input.trim()),
  }
}

function summarizeInput(input: string, maxLength = 320) {
  const normalized = input.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

export function createPreviewFocus(input: {
  panel: WorkspacePanel
  source: string
  mode?: WorkspacePreviewFocus['mode']
  title: string
  body: string
  metadata?: string[]
}): Omit<WorkspacePreviewFocus, 'id' | 'createdAt'> {
  return {
    panel: input.panel,
    source: input.source,
    mode: input.mode || 'route',
    title: input.title,
    body: summarizeInput(input.body, 1200),
    metadata: input.metadata ?? [],
  }
}

export function createNavigationPreview(panel: WorkspacePanel, source: string, reason: string, input = '') {
  return createPreviewFocus({
    panel,
    source,
    title: `Surface: ${panel}`,
    body: input || reason,
    metadata: [reason],
  })
}

export function isWorkspacePanel(value: string): value is WorkspacePanel {
  return ['chat', 'console', 'memory', 'search', 'customize', 'projects', 'artifacts', 'business', 'legal', 'accounting', 'coding', 'images', 'reasoning', 'tools', 'settings', 'computer', 'browser', 'tasks', 'dispatch'].includes(value)
}