import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  copyFile: vi.fn(),
  cp: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
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

vi.mock('../process/child-process.js', () => ({
  openUrlInBrowser: vi.fn(),
  stopProcess: vi.fn(),
  waitForTcpPort: vi.fn()
}))

vi.mock('../renderer/mdsite-nuxt.js', () => ({
  ensurePreviewArtifacts: vi.fn(),
  ensureRendererDependencies: vi.fn(),
  generateRenderer: vi.fn(),
  getBundledRendererDir: vi.fn(),
  getRendererGeneratedOutputPath: vi.fn(),
  hasPreviewArtifacts: vi.fn(),
  prepareRenderer: vi.fn(),
  previewRendererForeground: vi.fn(),
  previewRendererInBackground: vi.fn(),
  startRendererForeground: vi.fn(),
  startRendererInBackground: vi.fn()
}))

import path from 'node:path'

import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import {
  buildDefaultMdsiteConfig,
  loadMdsiteConfig,
  resolveContentOutputPath,
  serializeMdsiteConfig
} from '../config/mdsite-config.js'
import { openUrlInBrowser, stopProcess, waitForTcpPort } from '../process/child-process.js'
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
  getBundledRendererDir,
  getRendererGeneratedOutputPath,
  hasPreviewArtifacts,
  prepareRenderer,
  previewRendererForeground,
  previewRendererInBackground,
  startRendererForeground,
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
const copyFileMock = vi.mocked(copyFile)
const mkdirMock = vi.mocked(mkdir)
const readFileMock = vi.mocked(readFile)
const getBundledRendererDirMock = vi.mocked(getBundledRendererDir)
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
const hasPreviewArtifactsMock = vi.mocked(hasPreviewArtifacts)
const ensureRendererDependenciesMock = vi.mocked(ensureRendererDependencies)
const generateRendererMock = vi.mocked(generateRenderer)
const getRendererGeneratedOutputPathMock = vi.mocked(getRendererGeneratedOutputPath)
const prepareRendererMock = vi.mocked(prepareRenderer)
const previewRendererForegroundMock = vi.mocked(previewRendererForeground)
const previewRendererInBackgroundMock = vi.mocked(previewRendererInBackground)
const startRendererForegroundMock = vi.mocked(startRendererForeground)
const startRendererInBackgroundMock = vi.mocked(startRendererInBackground)
const stopProcessMock = vi.mocked(stopProcess)
const openUrlInBrowserMock = vi.mocked(openUrlInBrowser)
const waitForTcpPortMock = vi.mocked(waitForTcpPort)

const loadedConfig = {
  config: {
    favicon: '',
    features: { bibleTooltips: true, sourceEdit: true },
    menu: [],
    footer: [],
    server: { output: '.output', path: '.renderer', repo: 'repo', gitBranch: 'main' },
    site: { canonical: '', name: 'Docs' },
    themes: { light: { colors: {} }, dark: { colors: {} } }
  },
  configDir: '/content',
  configPath: '/content/mdsite.yml',
  contentDir: '/content'
}

describe('command helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useRealTimers()
    loadConfigMock.mockResolvedValue(loadedConfig)
    hasPreviewArtifactsMock.mockResolvedValue(true)
    prepareRendererMock.mockResolvedValue({ rendererDir: '/renderer', rendererEnv: { TEST: '1' } })
    getRuntimeLogPathMock.mockImplementation((configDir, config, kind) => {
      return `${configDir}/${config.server.path}/${kind}.log`
    })
    resolveOutputMock.mockReturnValue('/content/.output/public')
    getRendererGeneratedOutputPathMock.mockReturnValue('/renderer/.output/public')
    getBundledRendererDirMock.mockReturnValue('/home/gizbar/git/mdsite/mdsite-nuxt')
    openUrlInBrowserMock.mockResolvedValue(true)
    waitForTcpPortMock.mockResolvedValue(true)
  })

  it('runInitCommand creates every mdsite file when the content dir is empty', async () => {
    const existing = new Set<string>()
    accessMock.mockImplementation(async (p) => {
      if (typeof p === 'string' && existing.has(p)) return
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: 'mdsite-nuxt-renderer', version: '0.1.0', description: 'old', scripts: { dev: 'x' } }))
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: 'mdsite-nuxt-renderer', version: '0.1.0', lockfileVersion: 3, packages: { '': { name: 'mdsite-nuxt-renderer', version: '0.1.0' } } }))

    await expect(runInitCommand('/content')).resolves.toBe(
      'Created mdsite.yml, .nvmrc, .renderer/package.json, .renderer/package-lock.json in /content.'
    )
    expect(buildDefaultConfigMock).toHaveBeenCalledWith('/content')
    expect(loadConfigMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith('/content/mdsite.yml', 'serialized-config', 'utf8')
    expect(writeFileMock).toHaveBeenCalledWith('/content/.nvmrc', '24\n', 'utf8')
    expect(mkdirMock).toHaveBeenCalledWith(path.join('/content', '.renderer'), { recursive: true })
    expect(readFileMock).toHaveBeenCalledWith(path.join('/home/gizbar/git/mdsite/mdsite-nuxt', 'package.json'), 'utf8')
    expect(readFileMock).toHaveBeenCalledWith(path.join('/home/gizbar/git/mdsite/mdsite-nuxt', 'package-lock.json'), 'utf8')
    const writtenPkg = writeFileMock.mock.calls.find(([p]) => p === path.join('/content', '.renderer', 'package.json'))
    expect(writtenPkg).toBeDefined()
    expect(writtenPkg![1]).toBe(`${JSON.stringify({ name: 'content', version: '0.1.0', description: 'Docs', scripts: { dev: 'x' } }, null, 2)}\n`)
    const writtenLock = writeFileMock.mock.calls.find(([p]) => p === path.join('/content', '.renderer', 'package-lock.json'))
    expect(writtenLock).toBeDefined()
    expect(writtenLock![1]).toBe(`${JSON.stringify({ name: 'content', version: '0.1.0', lockfileVersion: 3, packages: { '': { name: 'content', version: '0.1.0' } } }, null, 2)}\n`)
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith('/content/.gitignore', expect.stringContaining('.renderer/*'), 'utf8')
    expect(writeFileMock).toHaveBeenCalledWith('/content/.gitignore', expect.stringContaining('!.renderer/package.json'), 'utf8')
    expect(writeFileMock).toHaveBeenCalledWith('/content/.gitignore', expect.stringContaining('!.renderer/package-lock.json'), 'utf8')
    expect(writeFileMock).toHaveBeenCalledWith('/content/.gitignore', expect.stringContaining('.output/'), 'utf8')
  })

  it('runInitCommand preserves an existing .nvmrc and only creates the rest', async () => {
    const existing = new Set<string>(['/content/.nvmrc'])
    accessMock.mockImplementation(async (p) => {
      if (typeof p === 'string' && existing.has(p)) return
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: 'mdsite-nuxt-renderer', version: '0.1.0', description: 'old', scripts: { dev: 'x' } }))
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: 'mdsite-nuxt-renderer', version: '0.1.0', lockfileVersion: 3, packages: { '': { name: 'mdsite-nuxt-renderer', version: '0.1.0' } } }))

    await expect(runInitCommand('/content')).resolves.toBe(
      'Created mdsite.yml, .renderer/package.json, .renderer/package-lock.json in /content.'
    )
    expect(writeFileMock).not.toHaveBeenCalledWith('/content/.nvmrc', expect.anything(), expect.anything())
    expect(copyFileMock).not.toHaveBeenCalled()
  })

  it('runInitCommand loads an existing mdsite.yml to repair missing files without overwriting it', async () => {
    const existing = new Set<string>([
      '/content/mdsite.yml',
      '/content/.nvmrc',
      path.join('/content', '.renderer', 'package.json')
    ])
    accessMock.mockImplementation(async (p) => {
      if (typeof p === 'string' && existing.has(p)) return
      throw new Error('missing')
    })
    readFileMock.mockResolvedValueOnce(JSON.stringify({ name: 'mdsite-nuxt-renderer', version: '0.1.0', lockfileVersion: 3, packages: { '': { name: 'mdsite-nuxt-renderer', version: '0.1.0' } } }))

    await expect(runInitCommand('/content')).resolves.toBe('Created .renderer/package-lock.json in /content.')
    expect(loadConfigMock).toHaveBeenCalledWith('/content')
    expect(buildDefaultConfigMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalledWith('/content/mdsite.yml', expect.anything(), expect.anything())
    const writeFileCallsForPkg = writeFileMock.mock.calls.filter(([p]) => typeof p === 'string' && p === path.join('/content', '.renderer', 'package.json'))
    expect(writeFileCallsForPkg).toHaveLength(0)
    const writtenLock = writeFileMock.mock.calls.find(([p]) => p === path.join('/content', '.renderer', 'package-lock.json'))
    expect(writtenLock).toBeDefined()
    expect(writtenLock![1]).toBe(`${JSON.stringify({ name: 'content', version: '0.1.0', lockfileVersion: 3, packages: { '': { name: 'content', version: '0.1.0' } } }, null, 2)}\n`)
    expect(copyFileMock).not.toHaveBeenCalled()
  })

  it('runInitCommand reports nothing to create when every file already exists', async () => {
    const existing = new Set<string>([
      '/content/mdsite.yml',
      '/content/.nvmrc',
      path.join('/content', '.renderer', 'package.json'),
      path.join('/content', '.renderer', 'package-lock.json')
    ])
    accessMock.mockImplementation(async (p) => {
      if (typeof p === 'string' && existing.has(p)) return
      throw new Error('missing')
    })
    readFileMock.mockResolvedValueOnce('user-line\n')

    await expect(runInitCommand('/content')).resolves.toBe(
      'All mdsite files already present in /content; nothing to create.'
    )
    expect(writeFileMock).not.toHaveBeenCalledWith('/content/mdsite.yml', expect.anything(), expect.anything())
    expect(writeFileMock).not.toHaveBeenCalledWith('/content/.nvmrc', expect.anything(), expect.anything())
    expect(copyFileMock).not.toHaveBeenCalled()
    expect(writeFileMock).toHaveBeenCalledWith('/content/.gitignore', expect.any(String), 'utf8')
  })

  it('runStartCommand starts the renderer in the foreground by default without runtime metadata', async () => {
    await expect(runStartCommand('/content')).resolves.toBeUndefined()

    expect(readRuntimeStateMock).not.toHaveBeenCalled()
    expect(getRuntimeLogPathMock).not.toHaveBeenCalled()
    expect(startRendererInBackgroundMock).not.toHaveBeenCalled()
    expect(writeRuntimeStateMock).not.toHaveBeenCalled()
    expect(ensureRendererDependenciesMock).toHaveBeenCalledWith('/renderer')
    expect(startRendererForegroundMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
  })

  it('runStartCommand rejects detached mode when an active start process is already running', async () => {
    readRuntimeStateMock.mockResolvedValueOnce({ kind: 'start', pid: 44 } as never)
    isProcessRunningMock.mockReturnValueOnce(true)

    await expect(runStartCommand('/content', { detached: true })).rejects.toThrow('mdsite live is already running with PID 44.')
  })

  it('runStartCommand starts detached renderer for stale state and persists fresh runtime metadata', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T12:34:56.000Z'))
    readRuntimeStateMock.mockResolvedValueOnce({ kind: 'start', pid: 44 } as never)
    isProcessRunningMock.mockReturnValueOnce(false)
    startRendererInBackgroundMock.mockResolvedValueOnce(777)

    await expect(runStartCommand('/content', { detached: true })).resolves.toBe(
      'mdsite live running in background (PID 777). Log: /content/.renderer/start.log'
    )
    expect(ensureRendererDependenciesMock).toHaveBeenCalledWith('/renderer')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('localhost', 3000)
    expect(waitForTcpPortMock.mock.invocationCallOrder[0]).toBeGreaterThan(writeRuntimeStateMock.mock.invocationCallOrder[0] ?? 0)
    expect(openUrlInBrowserMock.mock.invocationCallOrder[0]).toBeGreaterThan(waitForTcpPortMock.mock.invocationCallOrder[0] ?? 0)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')
    expect(writeRuntimeStateMock).toHaveBeenCalledWith('/content', loadedConfig.config, expect.objectContaining({
      kind: 'start',
      pid: 777,
      rendererDir: '/renderer',
      command: ['npm', 'run', 'dev'],
      startedAt: '2026-04-10T12:34:56.000Z'
    }))
  })

  it('runStartCommand uses the configured start host and port when opening detached start', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    prepareRendererMock.mockResolvedValueOnce({
      rendererDir: '/renderer',
      rendererEnv: { HOST: '127.0.0.1', PORT: '4173', NUXT_HOST: 'start.local', NUXT_PORT: '4321' }
    })
    startRendererInBackgroundMock.mockResolvedValueOnce(778)

    await expect(runStartCommand('/content', { detached: true })).resolves.toBe(
      'mdsite live running in background (PID 778). Log: /content/.renderer/start.log'
    )
    expect(waitForTcpPortMock).toHaveBeenCalledWith('start.local', 4321)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://start.local:4321')
  })

  it('runStartCommand does not open the browser when detached start readiness times out', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    startRendererInBackgroundMock.mockResolvedValueOnce(779)
    waitForTcpPortMock.mockResolvedValueOnce(false)

    await expect(runStartCommand('/content', { detached: true })).resolves.toBe(
      'mdsite live running in background (PID 779). Log: /content/.renderer/start.log'
    )
    expect(waitForTcpPortMock).toHaveBeenCalledWith('localhost', 3000)
    expect(openUrlInBrowserMock).not.toHaveBeenCalled()
  })

  it('runStartCommand keeps succeeding when detached start readiness checks fail', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    startRendererInBackgroundMock.mockResolvedValueOnce(780)
    waitForTcpPortMock.mockRejectedValueOnce(new Error('connect failed'))

    await expect(runStartCommand('/content', { detached: true })).resolves.toBe(
      'mdsite live running in background (PID 780). Log: /content/.renderer/start.log'
    )
    expect(openUrlInBrowserMock).not.toHaveBeenCalled()
  })

  it('runStartCommand exposes the foreground renderer on the network when host is set', async () => {
    await expect(runStartCommand('/content', { host: '0.0.0.0' })).resolves.toBeUndefined()

    expect(startRendererForegroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      TEST: '1',
      NUXT_HOST: '0.0.0.0',
      HOST: '0.0.0.0',
      NITRO_HOST: '0.0.0.0'
    }))
  })

  it('runStartCommand binds the detached renderer to a custom host when host is set', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    startRendererInBackgroundMock.mockResolvedValueOnce(781)

    await expect(runStartCommand('/content', { detached: true, host: '0.0.0.0' })).resolves.toBe(
      'mdsite live running in background (PID 781). Log: /content/.renderer/start.log'
    )
    expect(startRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      NUXT_HOST: '0.0.0.0',
      HOST: '0.0.0.0',
      NITRO_HOST: '0.0.0.0'
    }), '/content/.renderer/start.log')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('0.0.0.0', 3000)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://0.0.0.0:3000')
  })

  it('runPreviewCommand previews in the foreground by default without runtime metadata', async () => {
    await expect(runPreviewCommand('/content')).resolves.toBeUndefined()

    expect(readRuntimeStateMock).not.toHaveBeenCalled()
    expect(getRuntimeLogPathMock).not.toHaveBeenCalled()
    expect(previewRendererInBackgroundMock).not.toHaveBeenCalled()
    expect(writeRuntimeStateMock).not.toHaveBeenCalled()
    expect(waitForTcpPortMock).not.toHaveBeenCalled()
    expect(openUrlInBrowserMock).not.toHaveBeenCalled()
    expect(ensureRendererDependenciesMock).toHaveBeenCalledWith('/renderer')
    expect(ensurePreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(previewRendererForegroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      TEST: '1',
      NUXT_HOST: 'localhost',
      NUXT_PORT: '3000',
      HOST: 'localhost',
      PORT: '3000',
      NITRO_HOST: 'localhost',
      NITRO_PORT: '3000'
    }))
  })

  it('runPreviewCommand rejects detached mode when an active preview process is already running', async () => {
    readRuntimeStateMock.mockResolvedValueOnce({ kind: 'preview', pid: 55 } as never)
    isProcessRunningMock.mockReturnValueOnce(true)

    await expect(runPreviewCommand('/content', { detached: true })).rejects.toThrow('mdsite static is already running with PID 55.')
  })

  it('runPreviewCommand enforces preview artifacts and persists preview runtime state in detached mode', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-10T13:00:00.000Z'))
    readRuntimeStateMock.mockResolvedValueOnce(null)
    previewRendererInBackgroundMock.mockResolvedValueOnce(888)

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 888). URL: http://localhost:3000 Log: /content/.renderer/preview.log'
    )
    expect(ensurePreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(ensurePreviewArtifactsMock.mock.invocationCallOrder[0]).toBeGreaterThan(ensureRendererDependenciesMock.mock.invocationCallOrder[0] ?? 0)
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      TEST: '1',
      NUXT_HOST: 'localhost',
      NUXT_PORT: '3000',
      HOST: 'localhost',
      PORT: '3000',
      NITRO_HOST: 'localhost',
      NITRO_PORT: '3000'
    }), '/content/.renderer/preview.log')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('localhost', 3000)
    expect(waitForTcpPortMock.mock.invocationCallOrder[0]).toBeGreaterThan(writeRuntimeStateMock.mock.invocationCallOrder[0] ?? 0)
    expect(openUrlInBrowserMock.mock.invocationCallOrder[0]).toBeGreaterThan(waitForTcpPortMock.mock.invocationCallOrder[0] ?? 0)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')
    expect(writeRuntimeStateMock).toHaveBeenCalledWith('/content', loadedConfig.config, expect.objectContaining({
      kind: 'preview',
      pid: 888,
      command: ['npm', 'run', 'preview'],
      startedAt: '2026-04-10T13:00:00.000Z'
    }))
  })

  it('runPreviewCommand prefers inherited preview host and port values for the detached preview URL', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    prepareRendererMock.mockResolvedValueOnce({
      rendererDir: '/renderer',
      rendererEnv: { HOST: '127.0.0.1', PORT: '4173', NUXT_HOST: 'preview.local', NUXT_PORT: '4321' }
    })
    previewRendererInBackgroundMock.mockResolvedValueOnce(999)

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 999). URL: http://preview.local:4321 Log: /content/.renderer/preview.log'
    )
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      HOST: 'preview.local',
      PORT: '4321',
      NUXT_HOST: 'preview.local',
      NUXT_PORT: '4321',
      NITRO_HOST: 'preview.local',
      NITRO_PORT: '4321'
    }), '/content/.renderer/preview.log')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('preview.local', 4321)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://preview.local:4321')
  })

  it('runPreviewCommand falls back to HOST and PORT when NUXT preview values are unset in detached mode', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    prepareRendererMock.mockResolvedValueOnce({
      rendererDir: '/renderer',
      rendererEnv: { HOST: '127.0.0.1', PORT: '4173' }
    })
    previewRendererInBackgroundMock.mockResolvedValueOnce(1000)

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 1000). URL: http://127.0.0.1:4173 Log: /content/.renderer/preview.log'
    )
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      HOST: '127.0.0.1',
      PORT: '4173',
      NUXT_HOST: '127.0.0.1',
      NUXT_PORT: '4173',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: '4173'
    }), '/content/.renderer/preview.log')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('127.0.0.1', 4173)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://127.0.0.1:4173')
  })

  it('runPreviewCommand exposes the foreground renderer on the network when host is set', async () => {
    await expect(runPreviewCommand('/content', { host: '0.0.0.0' })).resolves.toBeUndefined()

    expect(previewRendererForegroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      NUXT_HOST: '0.0.0.0',
      HOST: '0.0.0.0',
      NITRO_HOST: '0.0.0.0'
    }))
  })

  it('runPreviewCommand overrides inherited preview host when host is set in detached mode', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    prepareRendererMock.mockResolvedValueOnce({
      rendererDir: '/renderer',
      rendererEnv: { HOST: '127.0.0.1', PORT: '4173', NUXT_HOST: 'preview.local', NUXT_PORT: '4321' }
    })
    previewRendererInBackgroundMock.mockResolvedValueOnce(1003)

    await expect(runPreviewCommand('/content', { detached: true, host: '0.0.0.0' })).resolves.toBe(
      'mdsite static running in background (PID 1003). URL: http://0.0.0.0:4321 Log: /content/.renderer/preview.log'
    )
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({
      NUXT_HOST: '0.0.0.0',
      HOST: '0.0.0.0',
      NITRO_HOST: '0.0.0.0',
      NUXT_PORT: '4321'
    }), '/content/.renderer/preview.log')
    expect(waitForTcpPortMock).toHaveBeenCalledWith('0.0.0.0', 4321)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://0.0.0.0:4321')
  })

  it('runPreviewCommand does not open the browser when detached preview readiness times out', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    previewRendererInBackgroundMock.mockResolvedValueOnce(1001)
    waitForTcpPortMock.mockResolvedValueOnce(false)

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 1001). URL: http://localhost:3000 Log: /content/.renderer/preview.log'
    )
    expect(waitForTcpPortMock).toHaveBeenCalledWith('localhost', 3000)
    expect(openUrlInBrowserMock).not.toHaveBeenCalled()
  })

  it('runPreviewCommand keeps succeeding when detached preview readiness checks fail', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    previewRendererInBackgroundMock.mockResolvedValueOnce(1002)
    waitForTcpPortMock.mockRejectedValueOnce(new Error('connect failed'))

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 1002). URL: http://localhost:3000 Log: /content/.renderer/preview.log'
    )
    expect(openUrlInBrowserMock).not.toHaveBeenCalled()
  })

  it('runStartCommand auto-runs mdsite init when mdsite.yml is missing', async () => {
    accessMock.mockImplementation(async () => {
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce('{}').mockResolvedValueOnce('{}')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runStartCommand('/content')).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mdsite.yml found'))
    expect(writeFileMock).toHaveBeenCalledWith('/content/mdsite.yml', 'serialized-config', 'utf8')
    expect(loadConfigMock).toHaveBeenCalledWith('/content')
    expect(startRendererForegroundMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    consoleSpy.mockRestore()
  })

  it('runPreviewCommand auto-runs mdsite init when mdsite.yml is missing', async () => {
    accessMock.mockImplementation(async () => {
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce('{}').mockResolvedValueOnce('{}')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runPreviewCommand('/content')).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mdsite.yml found'))
    expect(writeFileMock).toHaveBeenCalledWith('/content/mdsite.yml', 'serialized-config', 'utf8')
    expect(loadConfigMock).toHaveBeenCalledWith('/content')
    expect(previewRendererForegroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({ TEST: '1' }))
    consoleSpy.mockRestore()
  })

  it('runPreviewCommand auto-runs mdsite init when mdsite.yml is missing in detached mode', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    accessMock.mockImplementation(async () => {
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce('{}').mockResolvedValueOnce('{}')
    previewRendererInBackgroundMock.mockResolvedValueOnce(5555)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 5555). URL: http://localhost:3000 Log: /content/.renderer/preview.log'
    )

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mdsite.yml found'))
    expect(writeFileMock).toHaveBeenCalledWith('/content/mdsite.yml', 'serialized-config', 'utf8')
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({ TEST: '1' }), '/content/.renderer/preview.log')
    consoleSpy.mockRestore()
  })

  it('runGenerateCommand auto-runs mdsite init when mdsite.yml is missing', async () => {
    accessMock.mockImplementation(async () => {
      throw new Error('missing')
    })
    buildDefaultConfigMock.mockResolvedValue(loadedConfig.config)
    serializeConfigMock.mockReturnValue('serialized-config')
    readFileMock.mockResolvedValueOnce('{}').mockResolvedValueOnce('{}')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runGenerateCommand('/content')).resolves.toBe('Generated site synced to /content/.output/public')

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mdsite.yml found'))
    expect(writeFileMock).toHaveBeenCalledWith('/content/mdsite.yml', 'serialized-config', 'utf8')
    expect(loadConfigMock).toHaveBeenCalledWith('/content')
    expect(generateRendererMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    consoleSpy.mockRestore()
  })

  it('runPreviewCommand auto-runs mdsite generate when generated output is missing', async () => {
    hasPreviewArtifactsMock.mockResolvedValueOnce(false)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runPreviewCommand('/content')).resolves.toBeUndefined()

    expect(hasPreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(generateRendererMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    expect(ensurePreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(previewRendererForegroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({ TEST: '1' }))
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No generated output found'))
    consoleSpy.mockRestore()
  })

  it('runPreviewCommand auto-runs mdsite generate in detached mode when generated output is missing', async () => {
    readRuntimeStateMock.mockResolvedValueOnce(null)
    hasPreviewArtifactsMock.mockResolvedValueOnce(false)
    previewRendererInBackgroundMock.mockResolvedValueOnce(1234)
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runPreviewCommand('/content', { detached: true })).resolves.toBe(
      'mdsite static running in background (PID 1234). URL: http://localhost:3000 Log: /content/.renderer/preview.log'
    )

    expect(hasPreviewArtifactsMock).toHaveBeenCalledWith('/renderer')
    expect(generateRendererMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    expect(previewRendererInBackgroundMock).toHaveBeenCalledWith('/renderer', expect.objectContaining({ TEST: '1' }), '/content/.renderer/preview.log')
    consoleSpy.mockRestore()
  })

  it('runGenerateCommand syncs renderer output to the configured destination', async () => {
    await expect(runGenerateCommand('/content')).resolves.toBe('Generated site synced to /content/.output/public')

    expect(generateRendererMock).toHaveBeenCalledWith('/renderer', { TEST: '1' })
    expect(rmMock).toHaveBeenCalledWith('/content/.output/public', { recursive: true, force: true })
    expect(cpMock).toHaveBeenCalledWith('/renderer/.output/public', '/content/.output/public', { recursive: true, force: true })
  })

  it('runGenerateCommand surfaces sync failures with the destination path', async () => {
    cpMock.mockRejectedValueOnce(new Error('permission denied'))

    await expect(runGenerateCommand('/content')).rejects.toThrow(
      'Failed to sync generated output to /content/.output/public: permission denied'
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
    expect(clearRuntimeStateMock).toHaveBeenNthCalledWith(1, '/content', loadedConfig.config, 'start')
    expect(clearRuntimeStateMock).toHaveBeenNthCalledWith(2, '/content', loadedConfig.config, 'preview')
  })
})
