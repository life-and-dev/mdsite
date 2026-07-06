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
 * Anchored on the project root (configDir — the directory containing
 * `mdsite.yml`) so that `<paths.build>` resolves at the project root
 * regardless of `paths.input`. Callers MUST pass `configDir`, not the
 * markdown content dir.
 */
export function getRuntimeDir(configDir: string, config: MdsiteConfig): string {
  return path.resolve(configDir, config.paths.build)
}

export function getRuntimeLogPath(configDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): string {
  return path.join(getRuntimeDir(configDir, config), `${RUNTIME_BASENAME[kind]}.log`)
}

export async function readRuntimeState(configDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): Promise<RuntimeProcessState | null> {
  const statePath = getStatePath(configDir, config, kind)
  try {
    const content = await readFile(statePath, 'utf8')
    return JSON.parse(content) as RuntimeProcessState
  } catch {
    return null
  }
}

export async function writeRuntimeState(configDir: string, config: MdsiteConfig, state: RuntimeProcessState): Promise<void> {
  await mkdir(getRuntimeDir(configDir, config), { recursive: true })
  await writeFile(getStatePath(configDir, config, state.kind), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function clearRuntimeState(configDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): Promise<void> {
  await rm(getStatePath(configDir, config, kind), { force: true })
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getStatePath(configDir: string, config: MdsiteConfig, kind: RuntimeProcessKind): string {
  return path.join(getRuntimeDir(configDir, config), `${RUNTIME_BASENAME[kind]}.json`)
}
