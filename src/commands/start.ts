import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, waitForRendererPort, waitForTcpPort } from '../process/child-process.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensureRendererDependencies, prepareRenderer, startRendererForeground, startRendererInBackground } from '../renderer/mdsite-nuxt.js'
import { ensureInitialized } from './init.js'

interface StartCommandOptions {
  detached?: boolean
  host?: string
}

export async function runStartCommand(contentDir: string, options: StartCommandOptions = {}): Promise<string | undefined> {
  await ensureInitialized(contentDir)
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
  const { config, contentDir: resolvedContentDir } = loaded

  const existingState = await readRuntimeState(resolvedContentDir, config, 'start')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite live is already running with PID ${existingState.pid}.`)
  }

  const { rendererDir, rendererEnv } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)

  const env = withHostEnv(rendererEnv, options.host)
  const logPath = getRuntimeLogPath(resolvedContentDir, config, 'start')
  const pid = await startRendererInBackground(rendererDir, env, logPath)

  await writeRuntimeState(resolvedContentDir, config, {
    kind: 'start',
    pid,
    logPath,
    rendererDir,
    contentDir: resolvedContentDir,
    command: ['npm', 'run', 'dev'],
    startedAt: new Date().toISOString()
  })

  const host = getStartHost(env)
  const configuredPort = Number.parseInt(getStartPort(env), 10)
  // Nuxt may fall back to the next free port when the configured one is occupied;
  // detect the actual port from the renderer log so we open the right URL.
  const actualPort = await waitForRendererPort(logPath, configuredPort)
  const startUrl = `http://${host}:${actualPort}`

  const startReady = await waitForTcpPort(host, actualPort).catch(() => false)
  if (startReady) {
    await openUrlInBrowser(startUrl)
  }

  return `mdsite live running in background (PID ${pid}). Log: ${logPath}`
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

function getStartHost(env: NodeJS.ProcessEnv): string {
  return env.NUXT_HOST ?? env.HOST ?? 'localhost'
}

function getStartPort(env: NodeJS.ProcessEnv): string {
  return env.NUXT_PORT ?? env.PORT ?? '3000'
}
