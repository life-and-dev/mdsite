import { loadMdsiteConfig } from '../config/mdsite-config.js'
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

  const logPath = getRuntimeLogPath(contentDir, 'preview')
  const pid = await previewRendererInBackground(rendererDir, rendererEnv, logPath)

  await writeRuntimeState(contentDir, {
    kind: 'preview',
    pid,
    logPath,
    rendererDir,
    contentDir,
    command: ['npm', 'run', 'preview'],
    startedAt: new Date().toISOString()
  })

  return `mdsite preview running in background (PID ${pid}). Log: ${logPath}`
}
