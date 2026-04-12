import { open } from 'node:fs/promises'
import { spawn } from 'node:child_process'

export async function runForeground(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'inherit'
  })

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 0))
  })

  if (exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}.`)
  }
}

export async function runBackground(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, logPath: string): Promise<number> {
  const logFile = await open(logPath, 'a')
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', logFile.fd, logFile.fd]
  })

  child.once('error', async (error) => {
    await logFile.appendFile(`${error instanceof Error ? error.stack || error.message : String(error)}\n`)
  })

  child.unref()
  await logFile.close()

  if (!child.pid) {
    throw new Error(`Failed to start ${command} ${args.join(' ')}.`)
  }

  return child.pid
}

export async function stopProcess(pid: number): Promise<boolean> {
  if (!isRunning(pid)) {
    return false
  }

  try {
    sendSignal(pid, 'SIGTERM')
  } catch {
    return false
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 150))
    if (!isRunning(pid)) {
      return true
    }
  }

  try {
    sendSignal(pid, 'SIGKILL')
  } catch {
    return false
  }

  return !isRunning(pid)
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === 'win32') {
    process.kill(pid, signal)
    return
  }

  process.kill(-pid, signal)
}
