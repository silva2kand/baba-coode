import { promises as fs } from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

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
  if (!command.trim()) throw new Error('Command cannot be empty.')
  const { stdout, stderr } = await execAsync(command, {
    cwd: process.cwd(),
    windowsHide: true,
    timeout: 10000,
  })
  return { stdout, stderr }
}
