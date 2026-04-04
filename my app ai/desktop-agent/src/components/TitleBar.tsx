type TitleBarProps = {
  onToggleSidebar: () => void
}

export function TitleBar({ onToggleSidebar }: TitleBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-700 px-4 py-2">
      <div className="text-sm font-semibold">SILVA AI Command Center</div>
      <button
        type="button"
        onClick={onToggleSidebar}
        className="rounded border border-gray-600 px-3 py-1 text-xs"
      >
        Toggle Sidebar
      </button>
    </header>
  )
}
