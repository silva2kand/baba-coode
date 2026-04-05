import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)
const MAX_COMMAND_LENGTH = 1000
const MAX_STDIO_LENGTH = 200_000

function detectDangerousCommand(command: string): string | null {
  const patterns: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\brm\s+-rf\b/i, reason: 'recursive deletion command' },
    { pattern: /\bremove-item\b[\s\S]*\b-recurse\b/i, reason: 'recursive deletion command' },
    { pattern: /(^|\s)del\s+\/[sq]/i, reason: 'destructive delete command' },
    { pattern: /\bformat\s+[a-z]:/i, reason: 'disk format command' },
    { pattern: /\bmkfs(\.[a-z0-9]+)?\b/i, reason: 'filesystem format command' },
    { pattern: /\bdiskpart\b/i, reason: 'disk partition command' },
    { pattern: /\breg\s+delete\b/i, reason: 'registry deletion command' },
    { pattern: /\bshutdown\b/i, reason: 'system shutdown command' },
    { pattern: /\breboot\b/i, reason: 'system reboot command' },
    { pattern: /\bcurl\b[\s\S]*\|\s*(sh|bash|powershell|pwsh)\b/i, reason: 'remote script pipe execution' },
    { pattern: /\biwr\b[\s\S]*\|\s*(iex|invoke-expression)\b/i, reason: 'remote script pipe execution' },
  ]

  for (const item of patterns) {
    if (item.pattern.test(command)) {
      return item.reason
    }
  }

  return null
}

export async function readTextFile(targetPath: string) {
  const resolvedPath = path.resolve(targetPath)
  const MAX_BYTES = 1_000_000
  const stat = await fs.stat(resolvedPath)
  const size = stat.size
  const content = await fs.readFile(resolvedPath, 'utf8')
  return {
    path: resolvedPath,
    size,
    content: content.slice(0, MAX_BYTES),
    truncated: size > MAX_BYTES,
  }
}

export async function writeTextFile(targetPath: string, content: string): Promise<{ path: string; ok: boolean }> {
  const resolvedPath = path.resolve(targetPath)
  await fs.writeFile(resolvedPath, content, 'utf8')
  return { path: resolvedPath, ok: true }
}

export async function executeBash(command: string): Promise<{ stdout: string; stderr: string }> {
  const trimmed = command.trim()
  if (!trimmed) throw new Error('Command cannot be empty.')
  if (trimmed.length > MAX_COMMAND_LENGTH) {
    throw new Error(`Command is too long (${trimmed.length} chars).`)
  }

  const dangerousReason = detectDangerousCommand(trimmed)
  if (dangerousReason) {
    throw new Error(`Blocked command for safety: ${dangerousReason}.`)
  }

  const { stdout, stderr } = await execAsync(trimmed, {
    cwd: process.cwd(),
    windowsHide: true,
    timeout: 12000,
    maxBuffer: 1024 * 1024,
  })
  return {
    stdout: stdout.slice(0, MAX_STDIO_LENGTH),
    stderr: stderr.slice(0, MAX_STDIO_LENGTH),
  }
}
