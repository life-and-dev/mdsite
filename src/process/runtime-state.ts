import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type RuntimeProcessKind = 'start' | 'preview'

export interface RuntimeProcessState {
  kind: RuntimeProcessKind
  pid: number
  logPath: string
  rendererDir: string
  contentDir: string
  command: string[]
  startedAt: string
}

const runtimeDirectoryName = '.mdsite-runtime'

export function getRuntimeDir(contentDir: string): string {
  return path.join(contentDir, runtimeDirectoryName)
}

export function getRuntimeLogPath(contentDir: string, kind: RuntimeProcessKind): string {
  if (kind === 'preview') {
    return path.join(contentDir, 'mdsite.log')
  }

  return path.join(getRuntimeDir(contentDir), `${kind}.log`)
}

export async function readRuntimeState(contentDir: string, kind: RuntimeProcessKind): Promise<RuntimeProcessState | null> {
  const statePath = getStatePath(contentDir, kind)

  try {
    const content = await readFile(statePath, 'utf8')
    return JSON.parse(content) as RuntimeProcessState
  } catch {
    return null
  }
}

export async function writeRuntimeState(contentDir: string, state: RuntimeProcessState): Promise<void> {
  await mkdir(getRuntimeDir(contentDir), { recursive: true })
  await writeFile(getStatePath(contentDir, state.kind), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export async function clearRuntimeState(contentDir: string, kind: RuntimeProcessKind): Promise<void> {
  await rm(getStatePath(contentDir, kind), { force: true })
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getStatePath(contentDir: string, kind: RuntimeProcessKind): string {
  return path.join(getRuntimeDir(contentDir), `${kind}.json`)
}
