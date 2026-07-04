import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MdsiteConfig } from '../config/mdsite-config.js'

import {
  clearRuntimeState,
  getRuntimeDir,
  getRuntimeLogPath,
  isProcessRunning,
  readRuntimeState,
  writeRuntimeState
} from './runtime-state.js'

const config: MdsiteConfig = {
  favicon: '',
  features: { bibleTooltips: true, sourceEdit: true },
  menu: [],
  footer: [],
  server: { output: '.output', path: '.renderer', repo: 'repo', gitBranch: 'main' },
  site: { canonical: '', name: 'Docs' },
  themes: { light: { colors: {} }, dark: { colors: {} } }
}

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-state-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('runtime-state helpers', () => {
  it('builds runtime and log paths under the configured server path', () => {
    expect(getRuntimeDir('/content', config)).toBe(path.join('/content', '.renderer'))
    expect(getRuntimeLogPath('/content', config, 'preview')).toBe(path.join('/content', '.renderer', 'static.log'))
    expect(getRuntimeLogPath('/content', config, 'start')).toBe(path.join('/content', '.renderer', 'live.log'))
  })

  it('writes, reads, and clears runtime state', async () => {
    const contentDir = await makeTempDir()
    const state = {
      kind: 'start' as const,
      pid: 321,
      logPath: '/tmp/live.log',
      rendererDir: '/renderer',
      contentDir,
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T00:00:00.000Z'
    }

    await writeRuntimeState(contentDir, config, state)

    expect(await readRuntimeState(contentDir, config, 'start')).toEqual(state)

    const raw = await readFile(path.join(getRuntimeDir(contentDir, config), 'live.json'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)

    await clearRuntimeState(contentDir, config, 'start')
    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toBeNull()
  })

  it('returns null for missing or malformed state files', async () => {
    const contentDir = await makeTempDir()
    expect(await readRuntimeState(contentDir, config, 'preview')).toBeNull()

    const runtimeDir = getRuntimeDir(contentDir, config)
    await import('node:fs/promises').then(({ mkdir, writeFile }) => mkdir(runtimeDir, { recursive: true }).then(() => writeFile(path.join(runtimeDir, 'static.json'), '{oops', 'utf8')))

    await expect(readRuntimeState(contentDir, config, 'preview')).resolves.toBeNull()
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
