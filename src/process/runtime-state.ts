import { open, mkdir, readFile, rename, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { MdsiteConfig } from '../config/mdsite-config.js'

export type RuntimeProcessKind = 'start' | 'preview'

const RUNTIME_STATE_SCHEMA_VERSION = 1 as const

const RUNTIME_BASENAME: Record<RuntimeProcessKind, string> = {
  start: 'live',
  preview: 'static'
}

export interface RuntimeProcessState {
  schemaVersion?: typeof RUNTIME_STATE_SCHEMA_VERSION
  kind: RuntimeProcessKind
  pid: number
  processGroupId?: number
  logPath: string
  rendererDir: string
  contentDir: string
  command: string[]
  startedAt: string
}

export type RuntimeStateReadFailure = 'malformed' | 'unreadable'

export class RuntimeStateReadError extends Error {
  readonly failure: RuntimeStateReadFailure
  readonly statePath: string

  constructor(failure: RuntimeStateReadFailure, statePath: string, detail: string, cause?: unknown) {
    const action = failure === 'malformed'
      ? 'Fix or remove it after confirming no detached mdsite process is running.'
      : 'Check its permissions and retry.'
    super(`Runtime state file ${statePath} is ${failure}: ${detail}. ${action}`, { cause })
    this.name = 'RuntimeStateReadError'
    this.failure = failure
    this.statePath = statePath
  }
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
  let content: string

  try {
    content = await readFile(statePath, 'utf8')
  } catch (error) {
    if (isMissingFileError(error)) {
      return null
    }
    throw new RuntimeStateReadError('unreadable', statePath, getErrorMessage(error), error)
  }

  let value: unknown
  try {
    value = JSON.parse(content)
  } catch (error) {
    throw new RuntimeStateReadError('malformed', statePath, getErrorMessage(error), error)
  }

  const validationError = getValidationError(value, kind)
  if (validationError) {
    throw new RuntimeStateReadError('malformed', statePath, validationError)
  }

  return value as RuntimeProcessState
}

export async function writeRuntimeState(configDir: string, config: MdsiteConfig, state: RuntimeProcessState): Promise<void> {
  const runtimeDir = getRuntimeDir(configDir, config)
  const statePath = getStatePath(configDir, config, state.kind)
  const tempPath = path.join(runtimeDir, `.${path.basename(statePath)}.${process.pid}.${randomUUID()}.tmp`)
  const persistedState: RuntimeProcessState = {
    ...state,
    schemaVersion: RUNTIME_STATE_SCHEMA_VERSION,
    processGroupId: state.processGroupId ?? (process.platform === 'win32' ? undefined : state.pid)
  }

  await mkdir(runtimeDir, { recursive: true })

  let tempFile: Awaited<ReturnType<typeof open>> | undefined
  try {
    tempFile = await open(tempPath, 'wx')
    await tempFile.writeFile(`${JSON.stringify(persistedState, null, 2)}\n`, 'utf8')
    await tempFile.sync()
    await tempFile.close()
    tempFile = undefined
    await rename(tempPath, statePath)
  } catch (error) {
    await tempFile?.close().catch(() => undefined)
    await rm(tempPath, { force: true }).catch(() => undefined)
    throw error
  }
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

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getValidationError(value: unknown, expectedKind: RuntimeProcessKind): string | null {
  if (!isRecord(value)) {
    return 'expected a JSON object'
  }
  if (value.schemaVersion !== undefined && value.schemaVersion !== RUNTIME_STATE_SCHEMA_VERSION) {
    return 'unsupported schemaVersion'
  }
  if (value.kind !== expectedKind) {
    return `expected kind ${expectedKind}`
  }
  if (!isPositiveInteger(value.pid)) {
    return 'pid must be a positive integer'
  }
  if (value.processGroupId !== undefined && !isPositiveInteger(value.processGroupId)) {
    return 'processGroupId must be a positive integer'
  }
  if (value.processGroupId !== undefined && value.processGroupId !== value.pid) {
    return 'processGroupId must match pid'
  }
  if (!isNonEmptyString(value.logPath) || !isNonEmptyString(value.rendererDir) || !isNonEmptyString(value.contentDir)) {
    return 'logPath, rendererDir, and contentDir must be non-empty strings'
  }
  if (!Array.isArray(value.command) || value.command.length === 0 || !value.command.every(isNonEmptyString)) {
    return 'command must be a non-empty string array'
  }
  if (!isNonEmptyString(value.startedAt) || Number.isNaN(Date.parse(value.startedAt))) {
    return 'startedAt must be a valid timestamp'
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
