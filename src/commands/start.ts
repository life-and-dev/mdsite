import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { getRuntimeLogPath, isProcessRunning, readRuntimeState, writeRuntimeState } from '../process/runtime-state.js'
import { ensureRendererDependencies, prepareRenderer, startRendererInBackground } from '../renderer/mdsite-nuxt.js'

export async function runStartCommand(contentDir: string): Promise<string> {
  const existingState = await readRuntimeState(contentDir, 'start')
  if (existingState && isProcessRunning(existingState.pid)) {
    throw new Error(`mdsite start is already running with PID ${existingState.pid}.`)
  }

  const { config } = await loadMdsiteConfig(contentDir)
  const { rendererDir, rendererEnv } = await prepareRenderer(contentDir, config)

  await ensureRendererDependencies(rendererDir)

  const logPath = getRuntimeLogPath(contentDir, 'start')
  const pid = await startRendererInBackground(rendererDir, rendererEnv, logPath)

  await writeRuntimeState(contentDir, {
    kind: 'start',
    pid,
    logPath,
    rendererDir,
    contentDir,
    command: ['npm', 'run', 'dev'],
    startedAt: new Date().toISOString()
  })

  return `mdsite start running in background (PID ${pid}). Log: ${logPath}`
}
