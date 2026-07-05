import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, waitForRendererPort, waitForTcpPort } from '../process/child-process.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensurePreviewArtifacts, ensureRendererDependencies, hasPreviewArtifacts, prepareRenderer, previewRendererForeground, previewRendererInBackground } from '../renderer/mdsite-nuxt.js'
import { runGenerateCommand } from './generate.js'
import { ensureInitialized } from './init.js'

interface PreviewCommandOptions {
  detached?: boolean
  host?: string
}

async function ensureGeneratedOutput(contentDir: string, rendererOutputDir: string): Promise<void> {
  if (await hasPreviewArtifacts(rendererOutputDir)) {
    return
  }

  console.log('No generated output found. Running `mdsite generate` automatically...')
  console.log(await runGenerateCommand(contentDir))
}

export async function runPreviewCommand(contentDir: string, options: PreviewCommandOptions = {}): Promise<string | undefined> {
  await ensureInitialized(contentDir)
  if (options.detached) {
    return runDetachedPreviewCommand(contentDir, options)
  }

  const loaded = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv, rendererOutputDir } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await ensureGeneratedOutput(contentDir, rendererOutputDir)
  await ensurePreviewArtifacts(rendererOutputDir)
  await previewRendererForeground(rendererDir, getPreviewEnv(rendererEnv, options.host))

  return undefined
}

async function runDetachedPreviewCommand(contentDir: string, options: PreviewCommandOptions): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  const { config, contentDir: resolvedContentDir } = loaded

  const existingState = await readRuntimeState(resolvedContentDir, config, 'preview')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite static is already running with PID ${existingState.pid}.`)
  }

  const { rendererDir, rendererEnv, rendererOutputDir } = await prepareRenderer(loaded.contentDir, loaded.config, loaded)

  await ensureRendererDependencies(rendererDir)
  await ensureGeneratedOutput(resolvedContentDir, rendererOutputDir)
  await ensurePreviewArtifacts(rendererOutputDir)

  const previewEnv = getPreviewEnv(rendererEnv, options.host)
  const logPath = getRuntimeLogPath(resolvedContentDir, config, 'preview')
  const pid = await previewRendererInBackground(rendererDir, previewEnv, logPath)

  await writeRuntimeState(resolvedContentDir, config, {
    kind: 'preview',
    pid,
    logPath,
    rendererDir,
    contentDir: resolvedContentDir,
    command: ['npm', 'run', 'preview'],
    startedAt: new Date().toISOString()
  })

  const host = previewEnv.NUXT_HOST ?? previewEnv.HOST ?? 'localhost'
  const configuredPort = Number.parseInt(previewEnv.NUXT_PORT ?? previewEnv.PORT ?? '3000', 10)
  // Nitro may fall back to the next free port when the configured one is occupied;
  // detect the actual port from the renderer log so we open the right URL.
  const actualPort = await waitForRendererPort(logPath, configuredPort)
  const previewUrl = `http://${host}:${actualPort}`

  const previewReady = await waitForTcpPort(host, actualPort).catch(() => false)
  if (previewReady) {
    await openUrlInBrowser(previewUrl)
  }

  return `mdsite static running in background (PID ${pid}). URL: ${previewUrl} Log: ${logPath}`
}

function getPreviewEnv(env: NodeJS.ProcessEnv, overrideHost?: string): NodeJS.ProcessEnv {
  const host = overrideHost ?? env.NUXT_HOST ?? env.HOST ?? 'localhost'
  const port = env.NUXT_PORT ?? env.PORT ?? '3000'

  return {
    ...env,
    NUXT_HOST: host,
    NUXT_PORT: port,
    HOST: host,
    PORT: port,
    NITRO_HOST: host,
    NITRO_PORT: port
  }
}
