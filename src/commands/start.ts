import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, waitForTcpPort } from '../process/child-process.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensureRendererDependencies, prepareRenderer, startRendererForeground, startRendererInBackground } from '../renderer/mdsite-nuxt.js'

interface StartCommandOptions {
  detached?: boolean
}

export async function runStartCommand(contentDir: string, options: StartCommandOptions = {}): Promise<string | undefined> {
  if (options.detached) {
    return runDetachedStartCommand(contentDir)
  }

  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await startRendererForeground(rendererDir, rendererEnv)

  return undefined
}

async function runDetachedStartCommand(contentDir: string): Promise<string> {
  const existingState = await readRuntimeState(contentDir, 'start')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite start is already running with PID ${existingState.pid}.`)
  }

  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)

  const logPath = getRuntimeLogPath(contentDir, 'start')
  const pid = await startRendererInBackground(rendererDir, rendererEnv, logPath)
  const startUrl = getStartUrl(rendererEnv)

  await writeRuntimeState(contentDir, {
    kind: 'start',
    pid,
    logPath,
    rendererDir,
    contentDir,
    command: ['npm', 'run', 'dev'],
    startedAt: new Date().toISOString()
  })

  const startReady = await waitForTcpPort(getStartHost(rendererEnv), Number.parseInt(getStartPort(rendererEnv), 10)).catch(() => false)
  if (startReady) {
    await openUrlInBrowser(startUrl)
  }

  return `mdsite start running in background (PID ${pid}). Log: ${logPath}`
}

function getStartUrl(env: NodeJS.ProcessEnv): string {
  return `http://${getStartHost(env)}:${getStartPort(env)}`
}

function getStartHost(env: NodeJS.ProcessEnv): string {
  return env.NUXT_HOST ?? env.HOST ?? 'localhost'
}

function getStartPort(env: NodeJS.ProcessEnv): string {
  return env.NUXT_PORT ?? env.PORT ?? '3000'
}
