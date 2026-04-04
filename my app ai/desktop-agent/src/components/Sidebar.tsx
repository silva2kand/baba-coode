type SidebarProps = {
  open: boolean
  activePanel: 'chat' | 'settings'
  onPanelChange: (panel: 'chat' | 'settings') => void
}

export function Sidebar({ open, activePanel, onPanelChange }: SidebarProps) {
  if (!open) {
    return null
  }

  const buttonClass = (panel: 'chat' | 'settings') =>
    `w-full rounded border px-3 py-2 text-left text-sm ${activePanel === panel ? 'border-blue-500' : 'border-gray-600'}`

  return (
    <aside className="w-64 border-r border-gray-700 p-3">
      <nav className="space-y-2">
        <button type="button" className={buttonClass('chat')} onClick={() => onPanelChange('chat')}>
          Chat
        </button>
        <button type="button" className={buttonClass('settings')} onClick={() => onPanelChange('settings')}>
          Settings
        </button>
      </nav>
    </aside>
  )
}
