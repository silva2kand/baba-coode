import { useState, useEffect } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { TitleBar } from './components/TitleBar'
import { SettingsPanel } from './components/SettingsPanel'
import { useChatStore } from './store/chat'
import { queryEngine } from './lib/query-engine'

function App() {
  const [activePanel, setActivePanel] = useState<'chat' | 'settings'>('chat')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { initStore } = useChatStore()

  useEffect(() => {
    const init = async () => {
      await queryEngine.init()
      initStore()
    }
    init()
  }, [initStore])

  return (
    <div className="h-screen flex flex-col bg-claude-bg text-claude-text font-inter">
      <TitleBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          activePanel={activePanel}
          onPanelChange={setActivePanel}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activePanel === 'chat' && <ChatWindow />}
          {activePanel === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}

export default App
