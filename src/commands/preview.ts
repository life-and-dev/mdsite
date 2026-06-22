import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, waitForTcpPort } from '../process/child-process.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensurePreviewArtifacts, ensureRendererDependencies, prepareRenderer, previewRendererInBackground } from '../renderer/mdsite-nuxt.js'

export async function runPreviewCommand(contentDir: string): Promise<string> {
  const existingState = await readRuntimeState(contentDir, 'preview')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite preview is already running with PID ${existingState.pid}.`)
  }

  const { config } = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(contentDir, config)

  await ensureRendererDependencies(rendererDir)
  await ensurePreviewArtifacts(rendererDir)

  const previewEnv = getPreviewEnv(rendererEnv)
  const logPath = getRuntimeLogPath(contentDir, 'preview')
  const pid = await previewRendererInBackground(rendererDir, previewEnv, logPath)
  const previewUrl = getPreviewUrl(previewEnv)

  await writeRuntimeState(contentDir, {
    kind: 'preview',
    pid,
    logPath,
    rendererDir,
    contentDir,
    command: ['npm', 'run', 'preview'],
    startedAt: new Date().toISOString()
  })

  const previewReady = await waitForTcpPort(previewEnv.HOST ?? 'localhost', Number.parseInt(previewEnv.PORT ?? '3000', 10)).catch(() => false)
  if (previewReady) {
    await openUrlInBrowser(previewUrl)
  }

  return `mdsite preview running in background (PID ${pid}). URL: ${previewUrl} Log: ${logPath}`
}

function getPreviewUrl(env: NodeJS.ProcessEnv): string {
  const host = env.NUXT_HOST ?? env.HOST ?? 'localhost'
  const port = env.NUXT_PORT ?? env.PORT ?? '3000'

  return `http://${host}:${port}`
}

function getPreviewEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const host = env.NUXT_HOST ?? env.HOST ?? 'localhost'
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
