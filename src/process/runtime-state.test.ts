import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearRuntimeState,
  getRuntimeDir,
  getRuntimeLogPath,
  isProcessRunning,
  readRuntimeState,
  writeRuntimeState
} from './runtime-state.js'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-runtime-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('runtime-state helpers', () => {
  it('builds runtime and log paths under .mdsite-runtime', () => {
    expect(getRuntimeDir('/content')).toBe(path.join('/content', '.mdsite-runtime'))
    expect(getRuntimeLogPath('/content', 'preview')).toBe(path.join('/content', 'mdsite.log'))
    expect(getRuntimeLogPath('/content', 'start')).toBe(path.join('/content', '.mdsite-runtime', 'start.log'))
  })

  it('writes, reads, and clears runtime state', async () => {
    const contentDir = await makeTempDir()
    const state = {
      kind: 'start' as const,
      pid: 321,
      logPath: '/tmp/start.log',
      rendererDir: '/renderer',
      contentDir,
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T00:00:00.000Z'
    }

    await writeRuntimeState(contentDir, state)

    expect(await readRuntimeState(contentDir, 'start')).toEqual(state)

    const raw = await readFile(path.join(getRuntimeDir(contentDir), 'start.json'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)

    await clearRuntimeState(contentDir, 'start')
    await expect(readRuntimeState(contentDir, 'start')).resolves.toBeNull()
  })

  it('returns null for missing or malformed state files', async () => {
    const contentDir = await makeTempDir()
    expect(await readRuntimeState(contentDir, 'preview')).toBeNull()

    const runtimeDir = getRuntimeDir(contentDir)
    await import('node:fs/promises').then(({ mkdir, writeFile }) => mkdir(runtimeDir, { recursive: true }).then(() => writeFile(path.join(runtimeDir, 'preview.json'), '{oops', 'utf8')))

    await expect(readRuntimeState(contentDir, 'preview')).resolves.toBeNull()
  })

  it('detects running processes by probing process.kill', () => {
    const killSpy = vi.spyOn(process, 'kill')
    killSpy.mockImplementationOnce(() => true as never)
    expect(isProcessRunning(123)).toBe(true)

    killSpy.mockImplementationOnce(() => {
      throw new Error('gone')
    })
    expect(isProcessRunning(456)).toBe(false)
  })
})
