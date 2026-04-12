import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  cp: vi.fn(),
  rm: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('../config/mdsite-config.js', () => ({
  buildDefaultMdsiteConfig: vi.fn(),
  loadMdsiteConfig: vi.fn(),
  resolveContentOutputPath: vi.fn(),
  serializeMdsiteConfig: vi.fn()
}))

vi.mock('../process/runtime-state.js', () => ({
  clearRuntimeState: vi.fn(),
  getRuntimeLogPath: vi.fn(),
  isProcessRunning: vi.fn(),
  readRuntimeState: vi.fn(),
  writeRuntimeState: vi.fn()
}))

vi.mock('../renderer/mdsite-nuxt.js', () => ({
  ensurePreviewArtifacts: vi.fn(),
  ensureRendererDependencies: vi.fn(),
  generateRenderer: vi.fn(),
  getRendererGeneratedOutputPath: vi.fn(),
  prepareRenderer: vi.fn(),
  previewRendererInBackground: vi.fn(),
  startRendererInBackground: vi.fn()
}))

vi.mock('../process/child-process.js', () => ({
  stopProcess: vi.fn()
}))

import { access, cp, rm, writeFile } from 'node:fs/promises'

import {
  buildDefaultMdsiteConfig,
  loadMdsiteConfig,
  resolveContentOutputPath,
  serializeMdsiteConfig
} from '../config/mdsite-config.js'
import { stopProcess } from '../process/child-process.js'
import {
  clearRuntimeState,
  getRuntimeLogPath,
  isProcessRunning,
  readRuntimeState,
  writeRuntimeState
} from '../process/runtime-state.js'
import {
  ensurePreviewArtifacts,
  ensureRendererDependencies,
  generateRenderer,
  getRendererGeneratedOutputPath,
  prepareRenderer,
  previewRendererInBackground,
  startRendererInBackground
} from '../renderer/mdsite-nuxt.js'
import { runGenerateCommand } from './generate.js'
import { runInitCommand } from './init.js'
import { runPreviewCommand } from './preview.js'
import { runStartCommand } from './start.js'
import { runStopCommand } from './stop.js'

const accessMock = vi.mocked(access)
const cpMock = vi.mocked(cp)
const rmMock = vi.mocked(rm)
const writeFileMock = vi.mocked(writeFile)
const buildDefaultConfigMock = vi.mocked(buildDefaultMdsiteConfig)
const loadConfigMock = vi.mocked(loadMdsiteConfig)
const resolveOutputMock = vi.mocked(resolveContentOutputPath)
const serializeConfigMock = vi.mocked(serializeMdsiteConfig)
const clearRuntimeStateMock = vi.mocked(clearRuntimeState)
const getRuntimeLogPathMock = vi.mocked(getRuntimeLogPath)
const isProcessRunningMock = vi.mocked(isProcessRunning)
const readRuntimeStateMock = vi.mocked(readRuntimeState)
const writeRuntimeStateMock = vi.mocked(writeRuntimeState)
const ensurePreviewArtifactsMock = vi.mocked(ensurePreviewArtifacts)
const ensureRendererDependenciesMock = vi.mocked(ensureRendererDependencies)
const generateRendererMock = vi.mocked(generateRenderer)
const getRendererGeneratedOutputPathMock = vi.mocked(getRendererGeneratedOutputPath)
const prepareRendererMock = vi.mocked(prepareRenderer)
const previewRendererInBackgroundMock = vi.mocked(previewRendererInBackground)
const startRendererInBackgroundMock = vi.mocked(startRendererInBackground)
const stopProcessMock = vi.mocked(stopProcess)

const loadedConfig = {
  config: {
    favicon: '',
    features: { bibleTooltips: true, sourceEdit: true },
    menu: [],
    server: { output: '.output', path: '.renderer', repo: 'repo' },
    site: { canonical: '', name: 'Docs' },
    themes: { light: { colors: {} }, dark: { colors: {} } }
  },
  configPath: '/content/_mdsite.yml',
  contentDir: '/content'
}

describe('command helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    loadConfigMock.mockResolvedValue(loadedConfig)
    prepareRendererMock.mockResolvedValue({ rendererDir: '/renderer', rendererEnv: { TEST: '1' } })
    getRuntimeLogPathMock.mockImplementation((contentDir, kind) => `${contentDir}/.mdsite-runtime/${kind}.log`)
    resolveOutputMock.mockReturnValue('/content/public')
    getRendererGeneratedOutputPathMock.mockReturnValue('/renderer/.output/public')
  })

  it('runInitCommand creates _mdsite.yml only when it does not already exist', async () => {
    accessMock.mockRejectedValueOnce(new Error('missing'))
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')

    await expect(runInitCommand('/content')).resolves.toBeUndefined()
    expect(buildDefaultConfigMock).toHaveBeenCalledWith('/content')
    expect(writeFileMock).toHaveBeenCalledWith('/content/_mdsite.yml', 'serialized-config', 'utf8')

    accessMock.mockResolvedValueOnce(undefined)
    await expect(runInitCommand('/content')).rejects.toThrow('_mdsite.yml already exists at /content/_mdsite.yml.')
  })

  it('runStartCommand rejects when an active start process is already running', async () => {
    readRuntimeStateMock.mockResolvedValueOnce({ kind: 'start', pid: 44 } as never)
    isProcessRunningMock.mockReturnValueOnce(true)

    await expect(runStartCommand('/content')).rejects.toThrow('mdsite start is already running with PID 44.')
    expect(loadConfigMock).not.toHaveBeenCalled()
  })

  it('runStartCommand starts the renderer for stale state and persists fresh runtime metadata', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:34:56.000Z'))
    readRuntimeStateMock.mockResolvedValueOnce({ kind: 'start', pid: 44 } as never)
    isProcessRunningMock.mockReturnValueOnce(false)
    startRendererInBackgroundMock.mockResolvedValueOnce(777)

    await expect(runStartCommand('/content')).resolves.toBe(
      'mdsite start running in background (PID 777). Log: /content/.mdsite-runtime/start.log'
    )
    expect(ensureRendererDependenciesMock).toHaveBeenCalledWith('/renderer')
    expect(writeRuntimeStateMock).toHaveBeenCalledWith('/content', expect.objectContaining({
      kind: 'start',
      pid: 777,
      rendererDir: '/renderer',
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T12:34:56.000Z'
    }))
  })

  it('runPreviewCommand enforces preview artifacts and persists preview runtime state', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T13:00:00.000Z'))
    readRuntimeStateMock.mockResolvedValueOnce(null)
    previewRendererInBackgroundMock.mockResolvedValueOnce(888)

    await expect(runPreviewCommand('/content')).resolves.toBe(
      'mdsite preview running in background (PID 888). Log: /content/.mdsite-runtime/preview.log'
    )
    expect(ensurePreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(ensurePreviewArtifactsMock.mock.invocationCallOrder[0]).toBeGreaterThan(ensureRendererDependenciesMock.mock.invocationCallOrder[0] ?? 0)
    expect(writeRuntimeStateMock).toHaveBeenCalledWith('/content', expect.objectContaining({
      kind: 'preview',
      pid: 888,
      command: ['npm', 'run', 'preview'],
      startedAt: '2026-04-10T13:00:00.000Z'
    }))
  })

  it('runGenerateCommand syncs renderer output to the configured destination', async () => {
    await expect(runGenerateCommand('/content')).resolves.toBe('Generated site synced to /content/public')

    expect(generateRendererMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    expect(rmMock).toHaveBeenCalledWith('/content/public', { recursive: true, force: true })
    expect(cpMock).toHaveBeenCalledWith('/renderer/.output/public', '/content/public', { recursive: true, force: true })
  })

  it('runGenerateCommand surfaces sync failures with the destination path', async () => {
    cpMock.mockRejectedValueOnce(new Error('permission denied'))

    await expect(runGenerateCommand('/content')).rejects.toThrow(
      'Failed to sync generated output to /content/public: permission denied'
    )
  })

  it('runStopCommand handles nothing-running, stopped, and stale-state cases', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    await expect(runStopCommand('/content')).resolves.toBe('Nothing is running.')

    readRuntimeStateMock
      .mockResolvedValueOnce({ kind: 'start', pid: 11 } as never)
      .mockResolvedValueOnce({ kind: 'preview', pid: 22 } as never)
    stopProcessMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await expect(runStopCommand('/content')).resolves.toBe(
      'Stopped start process 11. Removed stale preview state for PID 22.'
    )
    expect(clearRuntimeStateMock).toHaveBeenNthCalledWith(1, '/content', 'start')
    expect(clearRuntimeStateMock).toHaveBeenNthCalledWith(2, '/content', 'preview')
  })
})
