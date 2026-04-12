import { clearRuntimeState, readRuntimeState } from '../process/runtime-state.js'
import { stopProcess } from '../process/child-process.js'

export async function runStopCommand(contentDir: string): Promise<string> {
  const states = await Promise.all([
    readRuntimeState(contentDir, 'start'),
    readRuntimeState(contentDir, 'preview')
  ])

  const messages: string[] = []

  for (const state of states) {
    if (!state) {
      continue
    }

    const stopped = await stopProcess(state.pid)
    await clearRuntimeState(contentDir, state.kind)

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
