import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  buildContentDataMock,
  copyFaviconsToPublicMock,
  existsSyncMock,
  generateFaviconsMock,
  generateWebManifestMock,
  loadMdsiteConfigSyncMock,
  parseYamlMock,
  readFileSyncMock,
  resolveMdsiteConfigPathMock,
  rmMock,
  startWatcherMock,
  statSyncMock,
  stringifyYamlMock,
  syncContentMock,
  writeFileSyncMock,
} = vi.hoisted(() => ({
  buildContentDataMock: vi.fn(),
  copyFaviconsToPublicMock: vi.fn(),
  existsSyncMock: vi.fn(),
  generateFaviconsMock: vi.fn(),
  generateWebManifestMock: vi.fn(),
  loadMdsiteConfigSyncMock: vi.fn(),
  parseYamlMock: vi.fn(),
  readFileSyncMock: vi.fn(),
  resolveMdsiteConfigPathMock: vi.fn(),
  rmMock: vi.fn(),
  startWatcherMock: vi.fn(),
  statSyncMock: vi.fn(),
  stringifyYamlMock: vi.fn(),
  syncContentMock: vi.fn(),
  writeFileSyncMock: vi.fn(),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    statSync: statSyncMock,
    readFileSync: readFileSyncMock,
    writeFileSync: writeFileSyncMock,
    promises: {
      rm: rmMock,
    },
  },
}))

vi.mock('yaml', () => ({
  default: {
    parse: parseYamlMock,
    stringify: stringifyYamlMock,
  },
}))

vi.mock('./generate-indices.js', () => ({
  buildContentData: buildContentDataMock,
}))

vi.mock('./generate-favicons.js', () => ({
  copyFaviconsToPublic: copyFaviconsToPublicMock,
  generateFavicons: generateFaviconsMock,
  generateWebManifest: generateWebManifestMock,
}))

vi.mock('./sync-content.js', () => ({
  startWatcher: startWatcherMock,
  syncContent: syncContentMock,
}))

vi.mock('../utils/mdsite-config.js', () => ({
  loadMdsiteConfigSync: loadMdsiteConfigSyncMock,
  resolveMdsiteConfigPath: resolveMdsiteConfigPathMock,
}))

import {
  prepareRendererRuntime,
  runBuildFallbackHooks,
  runSetupHooks,
} from './renderer-hooks.js'

describe('renderer hooks orchestration', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }

    resolveMdsiteConfigPathMock.mockReturnValue('/renderer/_mdsite.yml')
    loadMdsiteConfigSyncMock.mockReturnValue({
      config: { site: { name: 'Docs' } },
      configPath: '/renderer/_mdsite.yml',
      contentDir: '/renderer/docs',
    })
    existsSyncMock.mockImplementation((target: string) => target === '/renderer/docs')
    statSyncMock.mockReturnValue({ isFile: () => true })
    stringifyYamlMock.mockReturnValue('compat-config')
    generateFaviconsMock.mockResolvedValue(true)
    buildContentDataMock.mockResolvedValue(undefined)
    copyFaviconsToPublicMock.mockResolvedValue(undefined)
    generateWebManifestMock.mockResolvedValue(undefined)
    startWatcherMock.mockResolvedValue(undefined)
    syncContentMock.mockResolvedValue(undefined)
    rmMock.mockResolvedValue(undefined)
  })

  it('prepares runtime from the resolved mdsite config and exports stable env values', () => {
    const runtime = prepareRendererRuntime('/renderer', {
      configPath: '/renderer/_mdsite.yml',
      contentPath: '/input/docs',
    })

    expect(resolveMdsiteConfigPathMock).toHaveBeenCalledWith({
      configPath: '/renderer/_mdsite.yml',
      contentPath: '/input/docs',
    })
    expect(loadMdsiteConfigSyncMock).toHaveBeenCalledWith({
      configPath: '/renderer/_mdsite.yml',
      contentPath: '/input/docs',
    })
    expect(runtime).toEqual({
      config: { site: { name: 'Docs' } },
      configPath: '/renderer/_mdsite.yml',
      contentDir: '/renderer/docs',
      rootDir: '/renderer',
    })
    expect(process.env.NUXT_CONTENT_PATH).toBe('/renderer/docs')
    expect(process.env.CONTENT_DIR).toBe('/renderer/docs')
    expect(process.env.MDSITE_CONFIG_PATH).toBe('/renderer/_mdsite.yml')
  })

  it('falls back to the legacy compatibility config when no explicit mdsite config resolves', () => {
    resolveMdsiteConfigPathMock.mockReturnValue(undefined)
    existsSyncMock.mockImplementation((target: string) => (
      target === '/renderer/content.config.yml' || target === path.join('/renderer', 'legacy-docs')
    ))
    parseYamlMock.mockReturnValue({
      content: {
        path: 'legacy-docs',
      },
      siteName: 'Legacy Docs',
    })
    loadMdsiteConfigSyncMock.mockReturnValue({
      config: { site: { name: 'Legacy Docs' } },
      configPath: '/renderer/.mdsite-compat.yml',
      contentDir: path.join('/renderer', 'legacy-docs'),
    })

    const runtime = prepareRendererRuntime('/renderer')

    expect(readFileSyncMock).toHaveBeenCalledWith('/renderer/content.config.yml', 'utf8')
    expect(writeFileSyncMock).toHaveBeenCalledWith('/renderer/.mdsite-compat.yml', 'compat-config', 'utf8')
    expect(loadMdsiteConfigSyncMock).toHaveBeenCalledWith({
      configPath: '/renderer/.mdsite-compat.yml',
      contentPath: path.join('/renderer', 'legacy-docs'),
    })
    expect(runtime.configPath).toBe('/renderer/.mdsite-compat.yml')
    expect(process.env.MDSITE_CONFIG_PATH).toBe('/renderer/.mdsite-compat.yml')
    expect(process.env.NUXT_CONTENT_PATH).toBe(path.join('/renderer', 'legacy-docs'))
  })

  it('exits when no renderer config can be resolved', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`)
    })

    resolveMdsiteConfigPathMock.mockReturnValue(undefined)
    existsSyncMock.mockReturnValue(false)

    expect(() => prepareRendererRuntime('/renderer')).toThrow('process.exit(1)')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No _mdsite.yml configuration found'))

    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  it('exits when the resolved content directory does not exist', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`)
    })

    existsSyncMock.mockReturnValue(false)

    expect(() => prepareRendererRuntime('/renderer')).toThrow('process.exit(1)')
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Content directory not found'))

    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  it('runs the dev wrapper contract and clears .data for uncached dev startup', async () => {
    const runtime = await runSetupHooks('dev', '/renderer')

    expect(rmMock).toHaveBeenCalledWith(path.join('/renderer', '.data'), {
      force: true,
      recursive: true,
    })
    expect(startWatcherMock).toHaveBeenCalledTimes(1)
    expect(syncContentMock).not.toHaveBeenCalled()
    expect(buildContentDataMock).not.toHaveBeenCalled()
    expect(generateFaviconsMock).not.toHaveBeenCalled()
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
    expect(runtime.contentDir).toBe('/renderer/docs')
  })

  it('keeps cached dev startup on the same wrapper contract without clearing .data', async () => {
    await runSetupHooks('dev', '/renderer', { cached: true })

    expect(rmMock).not.toHaveBeenCalled()
    expect(startWatcherMock).toHaveBeenCalledTimes(1)
    expect(syncContentMock).not.toHaveBeenCalled()
  })

  it('runs non-dev setup hooks in orchestration order and publishes favicon assets on success', async () => {
    await runSetupHooks('generate', '/renderer', { configPath: '/renderer/_mdsite.yml' })

    expect(syncContentMock).toHaveBeenCalledTimes(1)
    expect(buildContentDataMock).toHaveBeenCalledTimes(1)
    expect(generateFaviconsMock).toHaveBeenCalledTimes(1)
    expect(copyFaviconsToPublicMock).toHaveBeenCalledTimes(1)
    expect(generateWebManifestMock).toHaveBeenCalledWith('Docs')
    expect(syncContentMock.mock.invocationCallOrder[0]).toBeLessThan(buildContentDataMock.mock.invocationCallOrder[0])
    expect(buildContentDataMock.mock.invocationCallOrder[0]).toBeLessThan(generateFaviconsMock.mock.invocationCallOrder[0])
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
  })

  it('runs setup mode through the same non-dev orchestration path as build and generate', async () => {
    await runSetupHooks('setup', '/renderer', { configPath: '/renderer/_mdsite.yml' })

    expect(syncContentMock).toHaveBeenCalledTimes(1)
    expect(buildContentDataMock).toHaveBeenCalledTimes(1)
    expect(generateFaviconsMock).toHaveBeenCalledTimes(1)
    expect(copyFaviconsToPublicMock).toHaveBeenCalledTimes(1)
    expect(generateWebManifestMock).toHaveBeenCalledWith('Docs')
    expect(startWatcherMock).not.toHaveBeenCalled()
    expect(rmMock).not.toHaveBeenCalled()
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
  })

  it('marks orchestration complete for build mode on the same shared non-dev path', async () => {
    await runSetupHooks('build', '/renderer', { configPath: '/renderer/_mdsite.yml' })

    expect(syncContentMock).toHaveBeenCalledTimes(1)
    expect(buildContentDataMock).toHaveBeenCalledTimes(1)
    expect(generateFaviconsMock).toHaveBeenCalledTimes(1)
    expect(startWatcherMock).not.toHaveBeenCalled()
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
  })

  it('runs build fallback hooks without publishing favicon assets when generation reports no output', async () => {
    generateFaviconsMock.mockResolvedValue(false)

    await runBuildFallbackHooks('Docs')

    expect(buildContentDataMock).toHaveBeenCalledTimes(1)
    expect(generateFaviconsMock).toHaveBeenCalledTimes(1)
    expect(copyFaviconsToPublicMock).not.toHaveBeenCalled()
    expect(generateWebManifestMock).not.toHaveBeenCalled()
  })

  it('keeps non-dev orchestration error-safe when favicon generation reports no output', async () => {
    generateFaviconsMock.mockResolvedValue(false)

    await runSetupHooks('generate', '/renderer', { configPath: '/renderer/_mdsite.yml' })

    expect(syncContentMock).toHaveBeenCalledTimes(1)
    expect(buildContentDataMock).toHaveBeenCalledTimes(1)
    expect(generateFaviconsMock).toHaveBeenCalledTimes(1)
    expect(copyFaviconsToPublicMock).not.toHaveBeenCalled()
    expect(generateWebManifestMock).not.toHaveBeenCalled()
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
  })
})
