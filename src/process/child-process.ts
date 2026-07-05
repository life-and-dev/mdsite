import { mkdir, open, readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'

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
  await mkdir(path.dirname(logPath), { recursive: true })
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

export async function openUrlInBrowser(url: string): Promise<boolean> {
  const openCommand = getBrowserOpenCommand(url)

  if (!openCommand) {
    return false
  }

  return new Promise<boolean>((resolve) => {
    try {
      const child = spawn(openCommand.command, openCommand.args, {
        detached: true,
        stdio: 'ignore'
      })

      child.once('error', () => resolve(false))
      child.once('spawn', () => {
        child.unref()
        resolve(true)
      })
    } catch {
      resolve(false)
    }
  })
}

export async function waitForTcpPort(host: string, port: number, options: { retryIntervalMs?: number, timeoutMs?: number, connectTimeoutMs?: number } = {}): Promise<boolean> {
  const retryIntervalMs = options.retryIntervalMs ?? 100
  const timeoutMs = options.timeoutMs ?? 5_000
  const connectTimeoutMs = options.connectTimeoutMs ?? retryIntervalMs
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    if (await canConnectToTcpPort(host, port, connectTimeoutMs)) {
      return true
    }

    if (Date.now() >= deadline) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs))
  }

  return false
}

// Matches Nuxt dev ("Local: http://host:port/") and Nitro preview
// ("Listening on http://[::]:port") URLs so the CLI can follow the
// fallback port Nuxt picks when the requested one is occupied.
// The host portion is non-greedy and tolerates both bare hostnames
// and IPv6 brackets (which contain ":"), and the trailing lookahead
// stops the host group from swallowing the port digits.
const LISTENING_URL_PATTERN = /(?:Local|Listening on)[\s:]*https?:\/\/(?:[^\s]+?):(\d+)(?=\D|$)/i

export async function waitForRendererPort(
  logPath: string,
  fallbackPort: number,
  options: { retryIntervalMs?: number, timeoutMs?: number } = {}
): Promise<number> {
  const retryIntervalMs = options.retryIntervalMs ?? 100
  const timeoutMs = options.timeoutMs ?? 5_000
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const content = await readFile(logPath, 'utf8')
      const match = content.match(LISTENING_URL_PATTERN)
      if (match) {
        const detected = Number.parseInt(match[1], 10)
        if (Number.isFinite(detected)) {
          return detected
        }
      }
    } catch {
      // Log file may not exist yet; keep polling until the deadline.
    }

    if (Date.now() >= deadline) {
      break
    }

    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs))
  }

  return fallbackPort
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

async function canConnectToTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port })

    const finish = (connected: boolean) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(connected)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.once('timeout', () => finish(false))
  })
}

function sendSignal(pid: number, signal: NodeJS.Signals): void {
  if (process.platform === 'win32') {
    process.kill(pid, signal)
    return
  }

  process.kill(-pid, signal)
}

function getBrowserOpenCommand(url: string): { command: string, args: string[] } | null {
  switch (process.platform) {
    case 'darwin':
      return { command: 'open', args: [url] }
    case 'win32':
      return { command: 'cmd', args: ['/c', 'start', '', url] }
    case 'linux':
      return { command: 'xdg-open', args: [url] }
    default:
      return null
  }
}
