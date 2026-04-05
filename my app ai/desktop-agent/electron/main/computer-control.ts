import { mouse, keyboard, Point, straightTo, Button, Key, getWindows } from '@nut-tree-fork/nut-js'

// Configure nut.js to not wait/delay excessively, aiming for agile response
mouse.config.autoDelayMs = 10
keyboard.config.autoDelayMs = 10

type MouseAction = 'move' | 'click' | 'doubleClick' | 'rightClick' | 'drag' | 'scroll'

export type MouseInput = {
  action: MouseAction
  x?: number
  y?: number
  toX?: number
  toY?: number
  scrollAmount?: number
}

export type KeyboardInput = {
  action: 'type' | 'key' | 'hotkey'
  text?: string
  key?: string
  modifiers?: string[]
}

type ComputerActionResult = {
  ok: boolean
  detail: string
}

// Map string keys to nut.js Key enum
const keyMap: Record<string, Key> = {
  'enter': Key.Enter,
  'return': Key.Return,
  'escape': Key.Escape,
  'space': Key.Space,
  'tab': Key.Tab,
  'backspace': Key.Backspace,
  'delete': Key.Delete,
  'up': Key.Up,
  'down': Key.Down,
  'left': Key.Left,
  'right': Key.Right,
  'home': Key.Home,
  'end': Key.End,
  'pageup': Key.PageUp,
  'pagedown': Key.PageDown,
  'shift': Key.LeftShift,
  'control': Key.LeftControl,
  'ctrl': Key.LeftControl,
  'alt': Key.LeftAlt,
  'super': Key.LeftSuper,
  'command': Key.LeftSuper,
  'meta': Key.LeftSuper,
  'windows': Key.LeftSuper,
}

// Add letters and numbers to keymap
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(97 + i)
  keyMap[letter] = Key.A + i
}
for (let i = 0; i <= 9; i++) {
  keyMap[i.toString()] = Key.Num0 + i
}

function parseKey(k: string): Key | null {
  const lower = k.toLowerCase()
  if (keyMap[lower]) return keyMap[lower]
  return null
}

export async function handleComputerMouse(input: MouseInput): Promise<ComputerActionResult> {
  try {
    switch (input.action) {
      case 'move':
        if (input.x !== undefined && input.y !== undefined) {
          await mouse.move(straightTo(new Point(input.x, input.y)))
          return { ok: true, detail: `Moved mouse to ${input.x}, ${input.y}.` }
        }
        return { ok: false, detail: `Missing x/y coordinates for mouse move.` }
      
      case 'click':
        if (input.x !== undefined && input.y !== undefined) {
          await mouse.setPosition(new Point(input.x, input.y))
        }
        await mouse.leftClick()
        return { ok: true, detail: `Clicked at current location.` }
        
      case 'doubleClick':
        if (input.x !== undefined && input.y !== undefined) {
          await mouse.setPosition(new Point(input.x, input.y))
        }
        await mouse.doubleClick(Button.LEFT)
        return { ok: true, detail: `Double-clicked at current location.` }
        
      case 'rightClick':
        if (input.x !== undefined && input.y !== undefined) {
          await mouse.setPosition(new Point(input.x, input.y))
        }
        await mouse.rightClick()
        return { ok: true, detail: `Right-clicked at current location.` }
        
      case 'drag':
        if (input.x !== undefined && input.y !== undefined && input.toX !== undefined && input.toY !== undefined) {
          await mouse.setPosition(new Point(input.x, input.y))
          await mouse.drag(straightTo(new Point(input.toX, input.toY)))
          return { ok: true, detail: `Dragged from ${input.x},${input.y} to ${input.toX},${input.toY}.` }
        }
        return { ok: false, detail: `Missing coordinates for drag operation.` }
        
      case 'scroll':
        if (input.scrollAmount) {
          if (input.scrollAmount > 0) {
            await mouse.scrollDown(input.scrollAmount)
          } else {
            await mouse.scrollUp(Math.abs(input.scrollAmount))
          }
          return { ok: true, detail: `Scrolled by ${input.scrollAmount}` }
        }
        return { ok: false, detail: 'Missing scrollAmount for scroll operation.' }
        
      default:
        return { ok: false, detail: `Unknown mouse action: ${input.action}` }
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleComputerKeyboard(input: KeyboardInput): Promise<ComputerActionResult> {
  try {
    switch (input.action) {
      case 'type':
        if (input.text) {
          await keyboard.type(input.text)
          return { ok: true, detail: `Typed text of length ${input.text.length}` }
        }
        return { ok: false, detail: 'Missing text for type operation.' }
        
      case 'key':
        if (input.key) {
          const k = parseKey(input.key)
          if (k !== null) {
            await keyboard.type(k)
            return { ok: true, detail: `Pressed key: ${input.key}` }
          }
          return { ok: false, detail: `Unknown key: ${input.key}` }
        }
        return { ok: false, detail: 'Missing key for key operation.' }
        
      case 'hotkey':
        const keysToPress: Key[] = []
        if (input.modifiers) {
          for (const mod of input.modifiers) {
            const k = parseKey(mod)
            if (k) keysToPress.push(k)
          }
        }
        if (input.key) {
          const mainKey = parseKey(input.key)
          if (mainKey !== null) {
            keysToPress.push(mainKey)
            await keyboard.type(...keysToPress)
            return { ok: true, detail: `Pressed hotkey: ${input.modifiers?.join('+')}+${input.key}` }
          }
        }
        return { ok: false, detail: 'Missing main key for hotkey.' }
        
      default:
        return { ok: false, detail: `Unknown keyboard action: ${input.action}` }
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleWindowList() {
  try {
    const windows = await getWindows()
    const result = []
    let i = 0
    for (const win of windows) {
      const title = await win.title
      const region = await win.region
      // Filter out empty windows that clutter the list (often hidden system handles)
      if (title.trim() && region.width > 0 && region.height > 0) {
        result.push({
          id: i++, // Nut.js doesn't expose native window IDs easily, using index for now
          title: title,
          processName: 'unknown', // Nut.js doesn't provide process names by default
          bounds: { x: region.left, y: region.top, width: region.width, height: region.height }
        })
      }
    }
    return result
  } catch (err) {
    console.error('Failed to list windows:', err)
    return []
  }
}

export async function handleFocusWindow(windowId: number) {
  try {
    const windows = await getWindows()
    // Find the non-empty window matching the index we stored
    const validWindows = []
    for (const win of windows) {
      if ((await win.title).trim()) validWindows.push(win)
    }
    const winToFocus = validWindows[windowId]
    if (winToFocus) {
      await winToFocus.focus()
      return { ok: true, detail: `Focused window: ${await winToFocus.title}` }
    }
    return { ok: false, detail: `Window ID ${windowId} not found.` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}
