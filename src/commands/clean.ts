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
  // Tracked PIDs live inside <paths.build>, so the clean would orphan them.
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

  // Anchor on the resolved content directory (not the config directory or
  // the cwd passed in), so that `paths.input: <subdir>` setups (where
  // `mdsite.yml` lives at the repo root and the markdown content lives in
  // a sub-folder) still resolve <paths.build> and <paths.output> to the
  // project that was actually built.
  const rendererPath = path.resolve(configDir, config.paths.build)
  const outputPath = path.resolve(configDir, config.paths.output)

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
    removed.push(config.paths.build)
  }
  if (outputExists) {
    removed.push(config.paths.output)
  }

  if (removed.length === 0) {
    return `Nothing to clean in ${configDir}.`
  }

  return `Removed ${joinRemoved(removed)} from ${configDir}.`
}

/**
 * Join the cleaned paths in a single human-readable phrase.
 * One path: `<a>`. Two: `<a> and <b>`. Three or more: `<a>, <b>, and <c>`.
 */
function joinRemoved(parts: string[]): string {
  if (parts.length === 1) {
    return parts[0]
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`
  }
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}
