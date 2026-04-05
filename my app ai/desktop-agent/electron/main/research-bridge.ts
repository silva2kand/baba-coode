import { promises as fs } from 'node:fs'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
export const APP_ROOT = path.resolve(moduleDir, '../..')

export type ResearchIpcRequest = {
  inputText: string
  model?: string
  denyTools?: string[]
  denyPrefixes?: string[]
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function findPythonExecutable(clawRoot: string) {
  const candidates = process.platform === 'win32'
    ? [
        path.join(clawRoot, 'venv', 'Scripts', 'python.exe'),
        'python',
        'py',
      ]
    : [
        path.join(clawRoot, 'venv', 'bin', 'python'),
        'python3',
        'python',
      ]

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (await pathExists(candidate)) {
        return candidate
      }
      continue
    }
    return candidate
  }

  return 'python'
}

export async function runResearch(request: ResearchIpcRequest) {
  const inputText = request.inputText.trim()
  if (!inputText) {
    throw new Error('Research input cannot be empty.')
  }

  const clawRoot = path.resolve(APP_ROOT, '../claw-code-main')
  const pythonExecutable = await findPythonExecutable(clawRoot)
  const args = ['-m', 'src.main', 'research', inputText]

  if (request.model) {
    args.push('--model', request.model)
  }

  for (const deniedTool of request.denyTools || []) {
    args.push('--deny-tool', deniedTool)
  }

  for (const deniedPrefix of request.denyPrefixes || []) {
    args.push('--deny-prefix', deniedPrefix)
  }

  const execArgs = pythonExecutable === 'py' ? ['-3', ...args] : args

  try {
    const { stdout, stderr } = await execFileAsync(pythonExecutable, execArgs, {
      cwd: clawRoot,
      windowsHide: true,
      timeout: 90000,
      maxBuffer: 1024 * 1024,
    })

    const trimmedStdout = stdout.trim()
    if (!trimmedStdout) {
      throw new Error(stderr.trim() || 'Python research command returned no output.')
    }

    return JSON.parse(trimmedStdout)
  } catch (error) {
    const stdout = typeof error === 'object' && error && 'stdout' in error && typeof error.stdout === 'string'
      ? error.stdout.trim()
      : ''
    const stderr = typeof error === 'object' && error && 'stderr' in error && typeof error.stderr === 'string'
      ? error.stderr.trim()
      : ''

    if (stdout) {
      try {
        return JSON.parse(stdout)
      } catch {
        // Fall through to a typed error below.
      }
    }

    if (error instanceof Error) {
      throw new Error(stderr || error.message)
    }

    throw new Error(stderr || 'Research bridge failed.')
  }
}