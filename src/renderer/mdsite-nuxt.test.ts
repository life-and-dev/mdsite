import path from 'node:path'
import type { Stats } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  cp: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('../process/child-process.js', () => ({
  runForeground: vi.fn(),
  runBackground: vi.fn()
}))

import { access, cp, mkdir, stat, writeFile } from 'node:fs/promises'

import { runBackground, runForeground } from '../process/child-process.js'
import {
  ensurePreviewArtifacts,
  ensureConfiguredRendererInstalled,
  ensureRendererDependencies,
  generateRenderer,
  getRendererGeneratedOutputPath,
  isInsideNodeModules,
  prepareRendererBackend,
  prepareConfiguredRenderer,
  prepareRenderer,
  previewRendererForeground,
  previewRendererInBackground,
  resolveRendererOutputPath,
  startRendererForeground,
  startRendererInBackground
} from './mdsite-nuxt.js'

const accessMock = vi.mocked(access)
const cpMock = vi.mocked(cp)
const mkdirMock = vi.mocked(mkdir)
const statMock = vi.mocked(stat)
const writeFileMock = vi.mocked(writeFile)
const runForegroundMock = vi.mocked(runForeground)
const runBackgroundMock = vi.mocked(runBackground)

const baseConfig = {
  features: { bibleTooltips: true, sourceEdit: '', footer: [] },
  menu: [],
  paths: { input: '', build: '.renderer', output: '.output' },
  site: { canonical: '', favicon: '', name: 'Docs' },
  themes: {
    light: { colors: { primary: '#111111' } },
    dark: { colors: { primary: '#222222' } }
  }
}

describe('mdsite-nuxt renderer helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    accessMock.mockResolvedValue(undefined)
    statMock.mockResolvedValue({ isDirectory: () => true } as Stats)
    runBackgroundMock.mockResolvedValue(999)
  })

  it('prepareRenderer runs the checked-in renderer in place in dev and writes bridge config/env files', async () => {
    const contentDir = '/workspace/content'
    const rendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    const prepared = await prepareRenderer(contentDir, baseConfig)

    expect(prepared.rendererDir).toBe(rendererDir)
    expect(prepared.rendererEnv.NUXT_CONTENT_PATH).toBe(contentDir)
    expect(prepared.rendererEnv.MDSITE_CONFIG_PATH).toBe(path.join(contentDir, 'mdsite.yml'))
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(rendererDir, 'content.config.yml'),
      expect.stringContaining('siteName: Docs'),
      'utf8'
    )
    expect(writeFileMock).toHaveBeenCalledWith(
      path.join(rendererDir, '.env'),
      expect.stringContaining(`NUXT_CONTENT_PATH=${JSON.stringify(contentDir)}`),
      'utf8'
    )
  })

  it('prepareRenderer uses effective content dir for content env and runs the checked-in renderer in place', async () => {
    const configDir = '/workspace'
    const contentDir = '/workspace/docs'
    const rendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')
    const configPath = path.join(configDir, 'mdsite.yml')

    const prepared = await prepareRenderer(contentDir, baseConfig, { configDir, configPath })

    expect(prepared.rendererDir).toBe(rendererDir)
    expect(prepared.rendererEnv.NUXT_CONTENT_PATH).toBe(contentDir)
    expect(prepared.rendererEnv.CONTENT_DIR).toBe(contentDir)
    expect(prepared.rendererEnv.MDSITE_CONFIG_PATH).toBe(configPath)
  })

  it('runs the checked-in renderer in place when the configured renderer dir is absent', async () => {
    const contentDir = '/workspace/content'
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    const prepared = await prepareRenderer(contentDir, { ...baseConfig, menu: ['docs/getting-started'] })

    expect(prepared.rendererDir).toBe(checkedInRendererDir)
  })

  it('prepareConfiguredRenderer resolves the configured renderer dir without checking the repo fallback', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')

    const prepared = await prepareConfiguredRenderer(contentDir, baseConfig)

    expect(prepared.rendererDir).toBe(configuredRendererDir)
    expect(statMock).toHaveBeenCalledWith(configuredRendererDir)
    expect(statMock).toHaveBeenCalledTimes(1)
    expect(accessMock).not.toHaveBeenCalled()
  })

  it('prepareConfiguredRenderer throws when the configured renderer directory is missing', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')

    statMock.mockRejectedValueOnce(new Error('missing configured renderer'))

    await expect(prepareConfiguredRenderer(contentDir, baseConfig)).rejects.toThrow(
      `Configured renderer directory not found at ${configuredRendererDir}.`
    )
  })

  it('prepareConfiguredRenderer throws when the configured renderer path is not a directory', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')

    statMock.mockResolvedValueOnce({ isDirectory: () => false } as Stats)

    await expect(prepareConfiguredRenderer(contentDir, baseConfig)).rejects.toThrow(
      `Configured renderer path is not a directory: ${configuredRendererDir}`
    )
  })

  it('ensureConfiguredRendererInstalled creates and populates the configured renderer dir', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    statMock.mockRejectedValueOnce(new Error('missing renderer'))

    await expect(ensureConfiguredRendererInstalled(contentDir, baseConfig)).resolves.toBe(configuredRendererDir)
    expect(mkdirMock).toHaveBeenCalledWith(configuredRendererDir, { recursive: true })
    expect(cpMock).toHaveBeenCalledWith(checkedInRendererDir, configuredRendererDir, expect.objectContaining({
      force: true,
      recursive: true
    }))

    const copyOptions = cpMock.mock.calls[0]?.[2]
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, 'package.json'), configuredRendererDir)).toBe(true)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, 'package-lock.json'), configuredRendererDir)).toBe(true)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, 'nuxt.config.ts'), configuredRendererDir)).toBe(true)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, 'node_modules'), configuredRendererDir)).toBe(false)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, '.nuxt'), configuredRendererDir)).toBe(false)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, '.output'), configuredRendererDir)).toBe(false)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, 'dist'), configuredRendererDir)).toBe(false)
    expect(copyOptions?.filter?.(path.join(checkedInRendererDir, '.cache'), configuredRendererDir)).toBe(false)
  })

  it('isInsideNodeModules detects renderer paths inside node_modules', () => {
    expect(isInsideNodeModules('/usr/lib/node_modules/@life-and-dev/mdsite/mdsite-nuxt')).toBe(true)
    expect(isInsideNodeModules('/home/user/proj/mdsite-nuxt')).toBe(false)
    expect(isInsideNodeModules(path.join(process.cwd(), 'node_modules', 'x', 'mdsite-nuxt'))).toBe(true)
    expect(isInsideNodeModules(path.join(process.cwd(), 'mdsite-nuxt'))).toBe(false)
  })

  it('throws an actionable error when the checked-in renderer directory does not exist', async () => {
    const contentDir = '/workspace/content'
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === checkedInRendererDir) {
        throw new Error('missing renderer')
      }
    })

    await expect(prepareRenderer(contentDir, baseConfig)).rejects.toThrow(
      `Renderer directory not found at ${checkedInRendererDir}. Expected checked-in mdsite-nuxt renderer.`
    )
  })

  it('installs renderer dependencies with npm ci when node_modules is missing and package-lock exists', async () => {
    const rendererDir = '/renderer'
    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === path.join(rendererDir, 'node_modules')) {
        throw new Error('missing node_modules')
      }
    })

    await ensureRendererDependencies(rendererDir)
    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['ci'], rendererDir, process.env)
  })

  it('installs renderer dependencies with npm install when node_modules and package-lock are missing', async () => {
    const rendererDir = '/renderer'
    const nodeModulesPath = path.join(rendererDir, 'node_modules')
    const packageLockPath = path.join(rendererDir, 'package-lock.json')
    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === nodeModulesPath || targetPath === packageLockPath) {
        throw new Error('missing path')
      }
    })

    await ensureRendererDependencies(rendererDir)
    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['install'], rendererDir, process.env)
  })

  it('skips renderer dependency install when node_modules exists', async () => {
    const rendererDir = '/renderer'

    await ensureRendererDependencies(rendererDir)
    expect(runForegroundMock).not.toHaveBeenCalled()
  })

  it('checks the generated preview artifact and exposes the generated output path', async () => {
    const rendererDir = '/renderer'

    await expect(ensurePreviewArtifacts(rendererDir)).resolves.toBeUndefined()
    expect(getRendererGeneratedOutputPath(rendererDir)).toBe(path.join(rendererDir, '.output', 'public'))
    expect(accessMock).toHaveBeenCalledWith(path.join(rendererDir, '.output', 'public'))

    accessMock.mockImplementationOnce(async () => {
      throw new Error('missing public output')
    })

    await expect(ensurePreviewArtifacts(rendererDir)).rejects.toThrow(
      'Preview is unavailable. Run `mdsite generate` before `mdsite static`.'
    )
  })

  it('delegates stable dev/generate/preview script names to child-process helpers', async () => {
    const env = { TEST: '1' }

    await startRendererInBackground('/renderer', env, '/logs/live.log')
    await previewRendererInBackground('/renderer', env, '/logs/static.log')
    await generateRenderer('/renderer', env)
    await startRendererForeground('/renderer', env)
    await previewRendererForeground('/renderer', env)

    expect(runBackgroundMock).toHaveBeenNthCalledWith(1, 'npm', ['run', 'dev'], '/renderer', env, '/logs/live.log')
    expect(runBackgroundMock).toHaveBeenNthCalledWith(2, 'npm', ['run', 'preview'], '/renderer', env, '/logs/static.log')
    expect(runForegroundMock).toHaveBeenNthCalledWith(1, 'npm', ['run', 'generate'], '/renderer', env)
    expect(runForegroundMock).toHaveBeenNthCalledWith(2, 'npm', ['run', 'dev'], '/renderer', env)
    expect(runForegroundMock).toHaveBeenNthCalledWith(3, 'npm', ['run', 'preview'], '/renderer', env)
  })

  it('delegates renderer backend preparation to the stable prepare:renderer hook name', async () => {
    const env = { TEST: '1' }

    await prepareRendererBackend('/renderer', env)

    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['run', 'prepare:renderer'], '/renderer', env)
  })

  it('resolveRendererOutputPath returns the checked-in renderer output in dev mode', async () => {
    const contentDir = '/workspace/content'
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    await expect(resolveRendererOutputPath(contentDir, baseConfig)).resolves.toBe(
      path.join(checkedInRendererDir, '.output')
    )
  })

  it('resolveRendererOutputPath returns undefined when the checked-in renderer is missing', async () => {
    const contentDir = '/workspace/content'
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === checkedInRendererDir) {
        throw new Error('missing submodule')
      }
    })

    await expect(resolveRendererOutputPath(contentDir, baseConfig)).resolves.toBeUndefined()
  })

  it('resolveRendererOutputPath returns undefined when paths.build points at the checked-in renderer', async () => {
    const rendererDirAsBuild = path.resolve(process.cwd(), 'mdsite-nuxt')
    const config = {
      ...baseConfig,
      paths: { ...baseConfig.paths, build: rendererDirAsBuild }
    }

    await expect(resolveRendererOutputPath(rendererDirAsBuild, config)).resolves.toBeUndefined()
  })
})
