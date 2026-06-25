import path from 'node:path'
import type { Stats } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:fs/promises', () => ({
  access: vi.fn(),
  copyFile: vi.fn(),
  rm: vi.fn(),
  stat: vi.fn(),
  symlink: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('../config/menu.js', () => ({
  generateMenuFromMarkdownFiles: vi.fn()
}))

vi.mock('../process/child-process.js', () => ({
  runForeground: vi.fn(),
  runBackground: vi.fn()
}))

import { access, copyFile, rm, stat, symlink, writeFile } from 'node:fs/promises'

import { generateMenuFromMarkdownFiles } from '../config/menu.js'
import { runBackground, runForeground } from '../process/child-process.js'
import {
  ensurePreviewArtifacts,
  ensureRendererDependencies,
  generateRenderer,
  getRendererGeneratedOutputPath,
  prepareRendererBackend,
  prepareConfiguredRenderer,
  prepareRenderer,
  previewRendererForeground,
  previewRendererInBackground,
  startRendererForeground,
  startRendererInBackground
} from './mdsite-nuxt.js'

const accessMock = vi.mocked(access)
const copyFileMock = vi.mocked(copyFile)
const rmMock = vi.mocked(rm)
const statMock = vi.mocked(stat)
const symlinkMock = vi.mocked(symlink)
const writeFileMock = vi.mocked(writeFile)
const generateMenuMock = vi.mocked(generateMenuFromMarkdownFiles)
const runForegroundMock = vi.mocked(runForeground)
const runBackgroundMock = vi.mocked(runBackground)

const baseConfig = {
  favicon: '',
  features: { bibleTooltips: true, sourceEdit: true },
  menu: [],
  server: { output: '.output', path: '.renderer', repo: 'repo' },
  site: { canonical: '', name: 'Docs' },
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
    generateMenuMock.mockResolvedValue(['generated/page'])
    runBackgroundMock.mockResolvedValue(999)
  })

  it('prepareRenderer prefers the configured renderer dir, generates a menu file, and writes bridge config/env files', async () => {
    const contentDir = '/workspace/content'
    const rendererDir = path.resolve(contentDir, '.renderer')

    const prepared = await prepareRenderer(contentDir, baseConfig)

    expect(prepared.rendererDir).toBe(rendererDir)
    expect(prepared.rendererEnv.NUXT_CONTENT_PATH).toBe(contentDir)
    expect(prepared.rendererEnv.MDSITE_CONFIG_PATH).toBe(path.join(contentDir, 'mdsite.yml'))
    expect(generateMenuMock).toHaveBeenCalledWith(contentDir)
    expect(writeFileMock).toHaveBeenCalledWith(path.join(contentDir, '_menu.yml'), '- generated/page\n', 'utf8')
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

  it('prepareRenderer uses effective content dir for content files and config dir for renderer path', async () => {
    const configDir = '/workspace'
    const contentDir = '/workspace/docs'
    const rendererDir = path.resolve(configDir, '.renderer')
    const configPath = path.join(configDir, 'mdsite.yml')

    const prepared = await prepareRenderer(contentDir, baseConfig, { configDir, configPath })

    expect(prepared.rendererDir).toBe(rendererDir)
    expect(prepared.rendererEnv.NUXT_CONTENT_PATH).toBe(contentDir)
    expect(prepared.rendererEnv.CONTENT_DIR).toBe(contentDir)
    expect(prepared.rendererEnv.MDSITE_CONFIG_PATH).toBe(configPath)
    expect(generateMenuMock).toHaveBeenCalledWith(contentDir)
    expect(writeFileMock).toHaveBeenCalledWith(path.join(contentDir, '_menu.yml'), '- generated/page\n', 'utf8')
  })

  it('falls back to the checked-in renderer when the configured renderer dir is absent', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === configuredRendererDir) {
        throw new Error('missing configured renderer')
      }
    })

    const prepared = await prepareRenderer(contentDir, { ...baseConfig, menu: ['docs/getting-started'] })

    expect(prepared.rendererDir).toBe(checkedInRendererDir)
    expect(writeFileMock).toHaveBeenCalledWith(path.join(contentDir, '_menu.yml'), '- docs/getting-started\n', 'utf8')
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

  it('throws an actionable error when neither the configured nor checked-in renderer directory exists', async () => {
    const contentDir = '/workspace/content'
    const configuredRendererDir = path.resolve(contentDir, '.renderer')
    const checkedInRendererDir = path.resolve(process.cwd(), 'mdsite-nuxt')

    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === configuredRendererDir || targetPath === checkedInRendererDir) {
        throw new Error('missing renderer')
      }
    })

    await expect(prepareRenderer(contentDir, baseConfig)).rejects.toThrow(
      `Renderer directory not found at ${checkedInRendererDir}. Expected checked-in mdsite-nuxt renderer.`
    )
  })

  it('throws when the configured favicon file does not exist', async () => {
    const contentDir = '/workspace/content'
    const sourcePath = path.resolve(contentDir, 'assets/favicon.svg')

    accessMock.mockImplementation(async (targetPath) => {
      if (targetPath === sourcePath) {
        throw new Error('missing favicon')
      }
    })

    await expect(prepareRenderer(contentDir, { ...baseConfig, favicon: 'assets/favicon.svg' })).rejects.toThrow(
      `Configured favicon file not found: ${sourcePath}`
    )
  })

  it('aliases a configured favicon to logo.svg and falls back to copy when symlink creation fails', async () => {
    const contentDir = '/workspace/content'
    const sourcePath = path.resolve(contentDir, 'assets/favicon.svg')
    const targetPath = path.join(contentDir, 'logo.svg')

    symlinkMock.mockRejectedValueOnce(new Error('symlink blocked'))

    await prepareRenderer(contentDir, { ...baseConfig, favicon: 'assets/favicon.svg', menu: ['docs/page'] })

    expect(rmMock).toHaveBeenCalledWith(targetPath, { force: true })
    expect(symlinkMock).toHaveBeenCalledWith(path.relative(contentDir, sourcePath), targetPath)
    expect(copyFileMock).toHaveBeenCalledWith(sourcePath, targetPath)
  })

  it('skips alias work when favicon already points at logo.svg', async () => {
    const contentDir = '/workspace/content'

    await prepareRenderer(contentDir, { ...baseConfig, favicon: 'logo.svg', menu: ['docs/page'] })

    expect(rmMock).not.toHaveBeenCalled()
    expect(symlinkMock).not.toHaveBeenCalled()
    expect(copyFileMock).not.toHaveBeenCalled()
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
      'Preview is unavailable. Run `mdsite generate` before `mdsite preview`.'
    )
  })

  it('delegates stable dev/generate/preview script names to child-process helpers', async () => {
    const env = { TEST: '1' }

    await startRendererInBackground('/renderer', env, '/logs/start.log')
    await previewRendererInBackground('/renderer', env, '/logs/preview.log')
    await generateRenderer('/renderer', env)
    await startRendererForeground('/renderer', env)
    await previewRendererForeground('/renderer', env)

    expect(runBackgroundMock).toHaveBeenNthCalledWith(1, 'npm', ['run', 'dev'], '/renderer', env, '/logs/start.log')
    expect(runBackgroundMock).toHaveBeenNthCalledWith(2, 'npm', ['run', 'preview'], '/renderer', env, '/logs/preview.log')
    expect(runForegroundMock).toHaveBeenNthCalledWith(1, 'npm', ['run', 'generate'], '/renderer', env)
    expect(runForegroundMock).toHaveBeenNthCalledWith(2, 'npm', ['run', 'dev'], '/renderer', env)
    expect(runForegroundMock).toHaveBeenNthCalledWith(3, 'npm', ['run', 'preview'], '/renderer', env)
  })

  it('delegates renderer backend preparation to the stable prepare:renderer hook name', async () => {
    const env = { TEST: '1' }

    await prepareRendererBackend('/renderer', env)

    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['run', 'prepare:renderer'], '/renderer', env)
  })
})
