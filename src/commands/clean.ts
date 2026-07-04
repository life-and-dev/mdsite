import { access, rm } from 'node:fs/promises'
import path from 'node:path'

import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { isProcessRunning, readRuntimeState } from '../process/runtime-state.js'

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function runCleanCommand(contentDir: string): Promise<string> {
  const loaded = await loadMdsiteConfig(contentDir)
  const { config, configDir } = loaded

  // Refuse to wipe state while a tracked process is still pointing at it.
  // Tracked PIDs live inside <server.path>, so the clean would orphan them.
  const trackedStates = await Promise.all([
    readRuntimeState(configDir, config, 'start'),
    readRuntimeState(configDir, config, 'preview')
  ])

  for (const state of trackedStates) {
    if (state && isProcessRunning(state.pid)) {
      const alias = state.kind === 'start' ? 'live' : 'static'
      throw new Error(`mdsite ${alias} is running with PID ${state.pid}. Run \`mdsite stop\` before \`mdsite clean\`.`)
    }
  }

  const rendererPath = path.resolve(configDir, config.server.path)
  const outputPath = path.resolve(configDir, config.server.output)

  const [rendererExists, outputExists] = await Promise.all([
    pathExists(rendererPath),
    pathExists(outputPath)
  ])

  // `force: true` lets us skip non-existent paths without a separate branch.
  await Promise.all([
    rm(rendererPath, { recursive: true, force: true }),
    rm(outputPath, { recursive: true, force: true })
  ])

  const removed: string[] = []
  if (rendererExists) {
    removed.push(config.server.path)
  }
  if (outputExists) {
    removed.push(config.server.output)
  }

  if (removed.length === 0) {
    return `Nothing to clean in ${contentDir}.`
  }

  return `Removed ${removed.join(' and ')} from ${contentDir}.`
}
