import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { clearRuntimeState, readRuntimeState } from '../process/runtime-state.js'
import { stopProcess } from '../process/child-process.js'

export async function runStopCommand(contentDir: string): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  const { config, contentDir: resolvedContentDir } = loaded

  // Resolve runtime state against the resolved content directory so that
  // `paths.input: <subdir>` setups find their state files (which live in
  // `<resolvedContentDir>/<paths.build>/`, not in the config directory).
  const states = await Promise.all([
    readRuntimeState(resolvedContentDir, config, 'start'),
    readRuntimeState(resolvedContentDir, config, 'preview')
  ])

  const messages: string[] = []

  for (const state of states) {
    if (!state) {
      continue
    }

    const stopped = await stopProcess(state.pid)
    await clearRuntimeState(resolvedContentDir, config, state.kind)

    if (stopped) {
      messages.push(`Stopped ${state.kind} process ${state.pid}.`)
      continue
    }

    messages.push(`Removed stale ${state.kind} state for PID ${state.pid}.`)
  }

  if (messages.length === 0) {
    return 'Nothing is running.'
  }

  return messages.join(' ')
}
