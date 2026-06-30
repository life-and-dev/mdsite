import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, waitForTcpPort } from '../process/child-process.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensureRendererDependencies, prepareRenderer, startRendererForeground, startRendererInBackground } from '../renderer/mdsite-nuxt.js'

interface StartCommandOptions {
  detached?: boolean
  host?: string
}

export async function runStartCommand(contentDir: string, options: StartCommandOptions = {}): Promise<string | undefined> {
  if (options.detached) {
    return runDetachedStartCommand(contentDir, options)
  }

  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await startRendererForeground(rendererDir, withHostEnv(rendererEnv, options.host))

  return undefined
}

async function runDetachedStartCommand(contentDir: string, options: StartCommandOptions): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  const { config, configDir } = loaded

  const existingState = await readRuntimeState(configDir, config, 'start')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite start is already running with PID ${existingState.pid}.`)
  }

  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)

  const env = withHostEnv(rendererEnv, options.host)
  const logPath = getRuntimeLogPath(configDir, config, 'start')
  const pid = await startRendererInBackground(rendererDir, env, logPath)
  const startUrl = getStartUrl(env)

  await writeRuntimeState(configDir, config, {
    kind: 'start',
    pid,
    logPath,
    rendererDir,
    contentDir,
    command: ['npm', 'run', 'dev'],
    startedAt: new Date().toISOString()
  })

  const startReady = await waitForTcpPort(getStartHost(env), Number.parseInt(getStartPort(env), 10)).catch(() => false)
  if (startReady) {
    await openUrlInBrowser(startUrl)
  }

  return `mdsite start running in background (PID ${pid}). Log: ${logPath}`
}

function withHostEnv(env: NodeJS.ProcessEnv, host: string | undefined): NodeJS.ProcessEnv {
  if (!host) {
    return env
  }

  return {
    ...env,
    NUXT_HOST: host,
    HOST: host,
    NITRO_HOST: host
  }
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
