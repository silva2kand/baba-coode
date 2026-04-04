import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { TitleBar } from './components/TitleBar'
import { SettingsPanel } from './components/SettingsPanel'
import { RightContextPanel } from './components/RightContextPanel'
import { useChatStore } from './store/chat'
import { useSettingsStore } from './store/settings'
import { queryEngine } from './lib/query-engine'

function App() {
  const [activePanel, setActivePanel] = useState<'chat' | 'settings'>('chat')
  const { initStore } = useChatStore()
  const { hydrate, ui, setUiSetting } = useSettingsStore()

  useEffect(() => {
    hydrate()

    const init = async () => {
      await queryEngine.init()
      initStore()
    }
    init()
  }, [hydrate, initStore])

  const fontSizeClass = ui.fontSize === 'sm' ? 'text-[13px]' : ui.fontSize === 'lg' ? 'text-[16px]' : 'text-[14px]'
  const shellClass = ui.theme === 'light' ? 'bg-white' : 'bg-claude-bg'

  return (
    <div className={`flex h-screen flex-col text-claude-text font-inter ${fontSizeClass} ${shellClass} ${ui.compactMode ? 'tracking-tight' : ''}`}>
      <TitleBar onToggleSidebar={() => setUiSetting('showSidebar', !ui.showSidebar)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={ui.showSidebar}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activePanel === 'chat' && <ChatWindow />}
          {activePanel === 'settings' && <SettingsPanel />}
        </div>

        {ui.showRightContextPanel ? <RightContextPanel activePanel={activePanel} /> : null}
      </div>
    </div>
  )
}

export default App
