import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
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
  RuntimeStateReadError,
  writeRuntimeState
} from './runtime-state.js'

const config: MdsiteConfig = {
  features: { bibleTooltips: true, sourceEdit: '', footer: [] },
  menu: [],
  paths: { ignore: [], input: '', build: '.renderer', output: '.output' },
  site: { canonical: '', favicon: '', name: 'Docs' },
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
    expect(getRuntimeLogPath('/content', config, 'preview')).not.toBe(path.join('/content', '.renderer', 'preview.log'))
    expect(getRuntimeLogPath('/content', config, 'start')).not.toBe(path.join('/content', '.renderer', 'start.log'))
  })

  it('atomically writes, reads, and clears runtime state', async () => {
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

    expect(await readRuntimeState(contentDir, config, 'start')).toEqual({
      ...state,
      schemaVersion: 1,
      ...(process.platform === 'win32' ? {} : { processGroupId: state.pid })
    })

    const runtimeDir = getRuntimeDir(contentDir, config)
    const raw = await readFile(path.join(runtimeDir, 'live.json'), 'utf8')
    expect(raw.endsWith('\n')).toBe(true)
    expect(await readdir(runtimeDir)).toEqual(['live.json'])

    await clearRuntimeState(contentDir, config, 'start')
    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toBeNull()
  })

  it('returns null only for missing state files', async () => {
    const contentDir = await makeTempDir()
    await expect(readRuntimeState(contentDir, config, 'preview')).resolves.toBeNull()
  })

  it('reports malformed JSON with its state path', async () => {
    const contentDir = await makeTempDir()
    const runtimeDir = getRuntimeDir(contentDir, config)
    const statePath = path.join(runtimeDir, 'static.json')
    await mkdir(runtimeDir, { recursive: true })
    await writeFile(statePath, '{oops', 'utf8')

    await expect(readRuntimeState(contentDir, config, 'preview')).rejects.toMatchObject({
      failure: 'malformed',
      statePath
    } satisfies Partial<RuntimeStateReadError>)
  })

  it('reports state read failures as unreadable', async () => {
    const contentDir = await makeTempDir()
    const statePath = path.join(getRuntimeDir(contentDir, config), 'static.json')
    await mkdir(statePath, { recursive: true })

    await expect(readRuntimeState(contentDir, config, 'preview')).rejects.toMatchObject({
      failure: 'unreadable',
      statePath
    } satisfies Partial<RuntimeStateReadError>)
  })

  it('accepts legacy state without identity metadata', async () => {
    const contentDir = await makeTempDir()
    const runtimeDir = getRuntimeDir(contentDir, config)
    const legacyState = {
      kind: 'preview' as const,
      pid: 654,
      logPath: '/tmp/static.log',
      rendererDir: '/renderer',
      contentDir,
      command: ['npm', 'run', 'preview'],
      startedAt: '2026-04-10T00:00:00.000Z'
    }
    await mkdir(runtimeDir, { recursive: true })
    await writeFile(path.join(runtimeDir, 'static.json'), JSON.stringify(legacyState), 'utf8')

    await expect(readRuntimeState(contentDir, config, 'preview')).resolves.toEqual(legacyState)
  })

  it('rejects process identity metadata that does not match the tracked PID', async () => {
    const contentDir = await makeTempDir()
    const runtimeDir = getRuntimeDir(contentDir, config)
    await mkdir(runtimeDir, { recursive: true })
    await writeFile(path.join(runtimeDir, 'live.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'start',
      pid: 321,
      processGroupId: 999,
      logPath: '/tmp/live.log',
      rendererDir: '/renderer',
      contentDir,
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T00:00:00.000Z'
    }), 'utf8')

    await expect(readRuntimeState(contentDir, config, 'start')).rejects.toMatchObject({
      failure: 'malformed'
    } satisfies Partial<RuntimeStateReadError>)
  })

  it('cleans its temporary file when the atomic rename fails', async () => {
    const contentDir = await makeTempDir()
    const runtimeDir = getRuntimeDir(contentDir, config)
    await mkdir(path.join(runtimeDir, 'live.json'), { recursive: true })

    await expect(writeRuntimeState(contentDir, config, {
      kind: 'start',
      pid: 321,
      logPath: '/tmp/live.log',
      rendererDir: '/renderer',
      contentDir,
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T00:00:00.000Z'
    })).rejects.toThrow()

    expect(await readdir(runtimeDir)).toEqual(['live.json'])
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
