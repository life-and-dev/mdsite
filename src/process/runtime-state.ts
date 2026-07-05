import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { MdsiteConfig } from '../config/mdsite-config.js'

export type RuntimeProcessKind = 'start' | 'preview'

const RUNTIME_BASENAME: Record<RuntimeProcessKind, string> = {
  start: 'live',
  preview: 'static'
}

export interface RuntimeProcessState {
  kind: RuntimeProcessKind
  pid: number
  logPath: string
  rendererDir: string
  contentDir: string
  command: string[]
  startedAt: string
}

/**
 * Working directory for tracked detached processes.
 *
 * Anchored on the content directory (not the config directory) so that
 * `<paths.build>` and `<paths.output>` resolve relative to the project the
 * user is building, even when `paths.input` points the CLI at a sub-folder
 * of the config directory.
 */
export function getRuntimeDir(contentDir: string, config: MdsiteConfig): string {
  return path.resolve(contentDir, config.paths.build)
}

export function getRuntimeLogPath(contentDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): string {
  return path.join(getRuntimeDir(contentDir, config), `${RUNTIME_BASENAME[kind]}.log`)
}

export async function readRuntimeState(contentDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): Promise<RuntimeProcessState | null> {
  const statePath = getStatePath(contentDir, config, kind)
  try {
    const content = await readFile(statePath, 'utf8')
    return JSON.parse(content) as RuntimeProcessState
  } catch {
    return null
  }
}

export async function writeRuntimeState(contentDir: string, config: MdsiteConfig, state: RuntimeProcessState): Promise<void> {
  await mkdir(getRuntimeDir(contentDir, config), { recursive: true })
  await writeFile(getStatePath(contentDir, config, state.kind), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function clearRuntimeState(contentDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): Promise<void> {
  await rm(getStatePath(contentDir, config, kind), { force: true })
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getStatePath(contentDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): string {
  return path.join(getRuntimeDir(contentDir, config), `${RUNTIME_BASENAME[kind]}.json`)
}
