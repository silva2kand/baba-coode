import type { ArtifactRecord } from '../types/research'
import type { RuntimeEvent } from '../store/runtime'
import type { WorkspacePanel } from '../types/workspace'

export type EffectiveLayout = 'claude' | 'wide' | 'split' | 'bottom-panel' | 'right-expanded'

export type LayoutState = {
  effectiveLayout: EffectiveLayout
  showRightPanel: boolean
  rightPanelWidthClass: string
  showBottomConsole: boolean
  showSideConsole: boolean
  sidebarWidthClass: string
}

export function deriveLayoutState(input: {
  activePanel: WorkspacePanel
  uiShowRightContextPanel: boolean
  latestRuntimeEvent: RuntimeEvent | null
  selectedArtifact: ArtifactRecord | null
}): LayoutState {
  const { activePanel, uiShowRightContextPanel, latestRuntimeEvent, selectedArtifact } = input

  let effectiveLayout: EffectiveLayout = 'claude'

  if (activePanel === 'coding') {
    effectiveLayout = 'split'
  } else if (activePanel === 'memory') {
    effectiveLayout = 'wide'
  } else if (activePanel === 'search') {
    effectiveLayout = 'wide'
  } else if (activePanel === 'computer' || activePanel === 'browser') {
    effectiveLayout = 'wide'
  } else if (activePanel === 'tasks') {
    effectiveLayout = 'split'
  } else if (activePanel === 'images' || activePanel === 'artifacts') {
    effectiveLayout = 'right-expanded'
  } else if (activePanel === 'tools' || activePanel === 'console') {
    effectiveLayout = 'bottom-panel'
  } else if (selectedArtifact && (selectedArtifact.kind === 'research' || selectedArtifact.kind === 'media' || selectedArtifact.kind === 'web')) {
    effectiveLayout = 'right-expanded'
  } else if (latestRuntimeEvent && (latestRuntimeEvent.kind === 'tool' || latestRuntimeEvent.kind === 'command')) {
    effectiveLayout = 'bottom-panel'
  }

  const showRightPanel = uiShowRightContextPanel || effectiveLayout === 'wide' || effectiveLayout === 'right-expanded' || activePanel === 'coding'
  const rightPanelWidthClass = effectiveLayout === 'right-expanded'
    ? 'xl:w-[32rem]'
    : effectiveLayout === 'wide'
      ? 'xl:w-[28rem]'
      : 'xl:w-80'

  return {
    effectiveLayout,
    showRightPanel,
    rightPanelWidthClass,
    showBottomConsole: effectiveLayout === 'bottom-panel' && activePanel !== 'console',
    showSideConsole: effectiveLayout === 'split' && activePanel === 'coding',
    sidebarWidthClass: activePanel === 'memory' ? 'w-80' : 'w-72',
  }
}