import { access, rm } from 'node:fs/promises'
import path from 'node:path'

import { loadMdsiteConfig } from '../config/mdsite-config.js'
import { isProcessRunning, readRuntimeState } from '../process/runtime-state.js'
import { resolveRendererOutputPath } from '../renderer/mdsite-nuxt.js'

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

  const rendererPath = path.resolve(configDir, config.paths.build)
  const outputPath = path.resolve(configDir, config.paths.output)
  const rendererOutputPath = await resolveRendererOutputPath(configDir, config)

  const [rendererExists, outputExists, rendererOutputExists] = await Promise.all([
    pathExists(rendererPath),
    pathExists(outputPath),
    rendererOutputPath ? pathExists(rendererOutputPath) : Promise.resolve(false)
  ])

  // `force: true` lets us skip non-existent paths without a separate branch.
  const removals: Array<Promise<unknown>> = [
    rm(rendererPath, { recursive: true, force: true }),
    rm(outputPath, { recursive: true, force: true })
  ]
  if (rendererOutputPath) {
    removals.push(rm(rendererOutputPath, { recursive: true, force: true }))
  }
  await Promise.all(removals)

  const removed: string[] = []
  if (rendererExists) {
    removed.push(config.paths.build)
  }
  if (outputExists) {
    removed.push(config.paths.output)
  }
  if (rendererOutputExists && rendererOutputPath) {
    removed.push(formatRemovedPath(contentDir, rendererOutputPath))
  }

  if (removed.length === 0) {
    return `Nothing to clean in ${contentDir}.`
  }

  return `Removed ${joinRemoved(removed)} from ${contentDir}.`
}

function formatRemovedPath(contentDir: string, targetPath: string): string {
  const relative = path.relative(contentDir, targetPath)
  if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
    return targetPath
  }
  return relative.split(path.sep).join('/')
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
