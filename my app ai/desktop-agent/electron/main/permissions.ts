import { TaskRiskLevel } from '../../src/types/electron-api'

export type ToolActionSchema = {
  name: string
  risk: TaskRiskLevel
  description: string
}

export const AgentToolsRegistry: Record<string, ToolActionSchema> = {
  // Computer Control
  'computer_mouse_move': { name: 'computer_mouse_move', risk: 'safe', description: 'Move the mouse to coordinates.' },
  'computer_mouse_click': { name: 'computer_mouse_click', risk: 'moderate', description: 'Click the mouse button.' },
  'computer_mouse_drag': { name: 'computer_mouse_drag', risk: 'moderate', description: 'Drag the mouse to coordinates.' },
  'computer_mouse_scroll': { name: 'computer_mouse_scroll', risk: 'safe', description: 'Scroll the screen.' },
  'computer_keyboard_type': { name: 'computer_keyboard_type', risk: 'moderate', description: 'Type text using the keyboard.' },
  'computer_keyboard_hotkey': { name: 'computer_keyboard_hotkey', risk: 'moderate', description: 'Press a keyboard shortcut.' },
  'computer_screenshot': { name: 'computer_screenshot', risk: 'safe', description: 'Take a screenshot of the main screen.' },
  'computer_focus_window': { name: 'computer_focus_window', risk: 'safe', description: 'Focus a specific window by ID.' },
  'computer_window_list': { name: 'computer_window_list', risk: 'safe', description: 'List all open windows.' },

  // Browser Automation
  'browser_open': { name: 'browser_open', risk: 'safe', description: 'Launch the automated browser.' },
  'browser_close': { name: 'browser_close', risk: 'safe', description: 'Close the browser.' },
  'browser_navigate': { name: 'browser_navigate', risk: 'moderate', description: 'Navigate to a URL.' },
  'browser_click': { name: 'browser_click', risk: 'moderate', description: 'Click a web element by selector.' },
  'browser_type': { name: 'browser_type', risk: 'moderate', description: 'Type text into a web element.' },
  'browser_extract_text': { name: 'browser_extract_text', risk: 'safe', description: 'Extract text content from the DOM.' },
  'browser_screenshot': { name: 'browser_screenshot', risk: 'safe', description: 'Take a screenshot of the active browser page.' },
  'browser_list_tabs': { name: 'browser_list_tabs', risk: 'safe', description: 'List open browser tabs.' },
  
  // High Risk Actions
  'system_bash_execute': { name: 'system_bash_execute', risk: 'dangerous', description: 'Execute an arbitrary terminal command.' },
  'system_file_read': { name: 'system_file_read', risk: 'safe', description: 'Read the contents of a file.' },
  'system_file_write': { name: 'system_file_write', risk: 'dangerous', description: 'Write or overwrite a file to the disk.' }
}

export function evaluateRisk(toolName: string): TaskRiskLevel {
  return AgentToolsRegistry[toolName]?.risk || 'dangerous' // Unknown tools default to dangerous risk
}
