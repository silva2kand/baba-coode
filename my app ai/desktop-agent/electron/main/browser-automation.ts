import { promises as fs } from 'node:fs'
import path from 'node:path'
import { chromium, type Browser, type BrowserContext, type Page, type ChromiumBrowserContext } from 'playwright'

let browser: Browser | null = null
let context: BrowserContext | null = null
let activePage: Page | null = null

export type BrowserSessionChannel = 'chromium' | 'chrome' | 'msedge'

export type BrowserSessionConfig = {
  channel: BrowserSessionChannel
  persistentProfile: boolean
  profileDirectory: string
  extensionPaths: string[]
}

const browserSessionConfig: BrowserSessionConfig = {
  channel: 'chromium',
  persistentProfile: false,
  profileDirectory: path.join(process.cwd(), '.silva-browser-profile'),
  extensionPaths: [],
}

type BrowserActionResult = {
  ok: boolean
  detail: string
  data?: any
}

function extensionArgs(extensionPaths: string[]) {
  if (extensionPaths.length === 0) {
    return []
  }

  const joined = extensionPaths.join(',')
  return [`--disable-extensions-except=${joined}`, `--load-extension=${joined}`]
}

async function validateExtensionPaths(extensionPaths: string[]) {
  const validPaths: string[] = []
  for (const entry of extensionPaths) {
    const resolved = path.resolve(entry)
    try {
      const stats = await fs.stat(resolved)
      if (stats.isDirectory()) {
        validPaths.push(resolved)
      }
    } catch {
      continue
    }
  }
  return validPaths
}

async function createContext() {
  const validExtensionPaths = await validateExtensionPaths(browserSessionConfig.extensionPaths)
  const args = extensionArgs(validExtensionPaths)
  const channel = browserSessionConfig.channel === 'chromium' ? undefined : browserSessionConfig.channel

  if (browserSessionConfig.persistentProfile) {
    await fs.mkdir(browserSessionConfig.profileDirectory, { recursive: true })
    const persistent = await chromium.launchPersistentContext(browserSessionConfig.profileDirectory, {
      headless: false,
      channel,
      args,
    })
    context = persistent
    browser = persistent.browser()
    activePage = persistent.pages()[0] ?? await persistent.newPage()
    return
  }

  browser = await chromium.launch({
    headless: false,
    channel,
    args,
  })
  context = await browser.newContext()
  activePage = await context.newPage()
}

export function getBrowserSessionConfig(): BrowserSessionConfig {
  return { ...browserSessionConfig, extensionPaths: [...browserSessionConfig.extensionPaths] }
}

export async function configureBrowserSession(nextConfig: Partial<BrowserSessionConfig>) {
  if (typeof nextConfig.channel === 'string') {
    browserSessionConfig.channel = nextConfig.channel
  }
  if (typeof nextConfig.persistentProfile === 'boolean') {
    browserSessionConfig.persistentProfile = nextConfig.persistentProfile
  }
  if (typeof nextConfig.profileDirectory === 'string' && nextConfig.profileDirectory.trim()) {
    browserSessionConfig.profileDirectory = path.resolve(nextConfig.profileDirectory)
  }
  if (Array.isArray(nextConfig.extensionPaths)) {
    browserSessionConfig.extensionPaths = await validateExtensionPaths(nextConfig.extensionPaths)
  }

  if (context) {
    await handleBrowserClose()
  }

  return getBrowserSessionConfig()
}

function assertPage(page: Page | null): asserts page is Page {
  if (!page) {
    throw new Error('No active browser page. Please open the browser first.')
  }
}

export async function handleBrowserOpen(): Promise<BrowserActionResult> {
  try {
    if (!browser) {
      await createContext()
      return {
        ok: true,
        detail: `Browser opened successfully using ${browserSessionConfig.channel}${browserSessionConfig.persistentProfile ? ' with persistent profile' : ''}.`,
        data: getBrowserSessionConfig(),
      }
    }
    return { ok: true, detail: 'Browser is already open.' }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserClose(): Promise<BrowserActionResult> {
  try {
    if (context || browser) {
      if (context) {
        await context.close()
      } else if (browser) {
        await browser.close()
      }
      browser = null
      context = null
      activePage = null
      return { ok: true, detail: 'Browser closed.' }
    }
    return { ok: true, detail: 'Browser was already closed.' }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserNavigate(url: string): Promise<BrowserActionResult> {
  try {
    assertPage(activePage)
    // prepend https if no protocol
    const finalUrl = url.startsWith('http') ? url : `https://${url}`
    await activePage.goto(finalUrl, { waitUntil: 'load' })
    return { ok: true, detail: `Navigated to ${finalUrl}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserClick(selector: string): Promise<BrowserActionResult> {
  try {
    assertPage(activePage)
    await activePage.click(selector, { timeout: 5000 })
    return { ok: true, detail: `Clicked element: ${selector}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserType(selector: string, text: string): Promise<BrowserActionResult> {
  try {
    assertPage(activePage)
    await activePage.fill(selector, text, { timeout: 5000 })
    return { ok: true, detail: `Typed into element: ${selector}` }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserExtract(selector?: string): Promise<BrowserActionResult> {
  try {
    assertPage(activePage)
    if (selector) {
      const text = await activePage.textContent(selector, { timeout: 5000 })
      return { ok: true, detail: `Extracted text from ${selector}`, data: text }
    } else {
      // Return full page text
      const bodyText = await activePage.evaluate(() => document.body.innerText)
      return { ok: true, detail: `Extracted full page text`, data: bodyText }
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserScreenshot(): Promise<BrowserActionResult> {
  try {
    assertPage(activePage)
    const buffer = await activePage.screenshot({ type: 'png' })
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`
    return { ok: true, detail: `Captured browser screenshot`, data: dataUrl }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function handleBrowserListTabs(): Promise<BrowserActionResult> {
  try {
    if (!context) {
      return { ok: false, detail: 'No browser context active.' }
    }
    const pages = context.pages()
    const tabs = await Promise.all(pages.map(async (p, idx) => {
      const title = await p.title().catch(() => 'Unknown Title')
      const pUrl = p.url()
      return { id: idx, title, url: pUrl, active: p === activePage }
    }))
    return { ok: true, detail: `Listed ${tabs.length} tabs`, data: tabs }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}
