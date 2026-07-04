import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const waitForTcpPortMock = vi.hoisted(() => vi.fn())

vi.mock('../process/child-process.js', () => ({
  openUrlInBrowser: vi.fn(),
  runBackground: vi.fn(),
  runForeground: vi.fn(),
  waitForTcpPort: waitForTcpPortMock,
  stopProcess: vi.fn()
}))

vi.mock('../renderer/mdsite-nuxt.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../renderer/mdsite-nuxt.js')>()
  return { ...actual, prepareRenderer: vi.fn() }
})

import { serializeMdsiteConfig, type MdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, stopProcess, waitForTcpPort, runBackground, runForeground } from '../process/child-process.js'
import { readRuntimeState } from '../process/runtime-state.js'
import { prepareRenderer } from '../renderer/mdsite-nuxt.js'
import { runGenerateCommand } from './generate.js'
import { runInitCommand } from './init.js'
import { runPreviewCommand } from './preview.js'
import { runStartCommand } from './start.js'
import { runStopCommand } from './stop.js'

const runBackgroundMock = vi.mocked(runBackground)
const runForegroundMock = vi.mocked(runForeground)
const openUrlInBrowserMock = vi.mocked(openUrlInBrowser)
const stopProcessMock = vi.mocked(stopProcess)
const waitForTcpPortMocked = vi.mocked(waitForTcpPort)
const prepareRendererMock = vi.mocked(prepareRenderer)

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-workflows-'))
  tempDirs.push(dir)
  return dir
}

async function createContentDir(): Promise<string> {
  const contentDir = await makeTempDir()
  await mkdir(path.join(contentDir, 'docs'), { recursive: true })
  await writeFile(path.join(contentDir, 'index.md'), '# Workspace Docs\n', 'utf8')
  await writeFile(path.join(contentDir, 'docs', 'guide.md'), '# Guide\n', 'utf8')
  return contentDir
}

async function createRendererDir(contentDir: string, withNodeModules: boolean = true): Promise<string> {
  const rendererDir = path.join(contentDir, '.renderer')
  await mkdir(rendererDir, { recursive: true })

  if (withNodeModules) {
    await mkdir(path.join(rendererDir, 'node_modules'), { recursive: true })
  }

  return rendererDir
}

async function writeConfig(contentDir: string, overrides: Partial<MdsiteConfig> = {}): Promise<MdsiteConfig> {
  const config: MdsiteConfig = {
    favicon: '',
    features: { bibleTooltips: true, sourceEdit: true },
    menu: [],
    footer: [],
    server: {
      output: '.output',
      path: '.renderer',
      repo: 'https://github.com/life-and-dev/mdsite',
      gitBranch: 'main',
      ...overrides.server
    },
    site: {
      canonical: '',
      name: 'Workspace Docs',
      ...overrides.site
    },
    themes: {
      light: { colors: {} },
      dark: { colors: {} }
    },
    ...overrides
  }

  await writeFile(path.join(contentDir, 'mdsite.yml'), serializeMdsiteConfig(config), 'utf8')
  return config
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('CLI workflow coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    openUrlInBrowserMock.mockResolvedValue(true)
    waitForTcpPortMocked.mockResolvedValue(true)
    prepareRendererMock.mockImplementation(async (contentDir, _config, _options) => {
      const rendererDir = path.join(contentDir, '.renderer')
      return {
        rendererDir,
        rendererEnv: {
          NUXT_CONTENT_PATH: contentDir,
          CONTENT_DIR: contentDir,
          MDSITE_CONFIG_PATH: path.join(contentDir, 'mdsite.yml')
        }
      }
    })
  })

  it('runInitCommand creates a valid mdsite.yml and pins Node 24 via .nvmrc', async () => {
    const contentDir = await createContentDir()

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml, .nvmrc in ${contentDir}.`)

    const configPath = path.join(contentDir, 'mdsite.yml')
    const configText = await readFile(configPath, 'utf8')
    expect(configText).toContain('name: Workspace Docs')
    expect(configText).toContain('output: .output')
    expect(configText).toContain('- docs/guide')

    const nvmrcPath = path.join(contentDir, '.nvmrc')
    const nvmrcText = await readFile(nvmrcPath, 'utf8')
    expect(nvmrcText).toBe('24\n')

    const gitignorePath = path.join(contentDir, '.gitignore')
    const gitignoreText = await readFile(gitignorePath, 'utf8')
    expect(gitignoreText).toContain('.mdsite/*')
    expect(gitignoreText).toContain('.output/')
    expect(gitignoreText).toContain('# end mdsite')
    expect(gitignoreText).not.toContain('!.mdsite/package.json')
    expect(gitignoreText).not.toContain('!.mdsite/package-lock.json')
  })

  it('runInitCommand preserves existing user .gitignore entries while adding mdsite managed patterns', async () => {
    const contentDir = await createContentDir()
    // Seed user entries PLUS a prior mdsite managed block (simulates a previous init) to prove the merge strips the old block and re-appends exactly one.
    const seededGitignore = [
      'secret.env',
      'build/',
      '# mdsite: generated state (renderer working dir; runtime artifacts and materialized renderer)',
      '.mdsite/*',
      '.output/',
      '# end mdsite'
    ].join('\n') + '\n'
    await writeFile(path.join(contentDir, '.gitignore'), seededGitignore, 'utf8')

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml, .nvmrc in ${contentDir}.`)

    const gitignoreText = await readFile(path.join(contentDir, '.gitignore'), 'utf8')
    // User entries preserved verbatim
    expect(gitignoreText).toContain('secret.env')
    expect(gitignoreText).toContain('build/')
    // Managed block present
    expect(gitignoreText).toContain('.mdsite/*')
    expect(gitignoreText).toContain('.output/')
    expect(gitignoreText).toContain('# end mdsite')
    expect(gitignoreText).not.toContain('!.mdsite/package.json')
    expect(gitignoreText).not.toContain('!.mdsite/package-lock.json')
    // Idempotent: exactly ONE managed header, ONE end marker, ONE of each required pattern (no duplication from the seeded prior block)
    expect(gitignoreText.split('# mdsite:').length - 1).toBe(1)
    expect(gitignoreText.split('# end mdsite').length - 1).toBe(1)
    expect(gitignoreText.split('.mdsite/*').length - 1).toBe(1)
    expect(gitignoreText.split('.output/').length - 1).toBe(1)
  })

  it('runInitCommand preserves user-authored lines that coincidentally match managed patterns outside the block', async () => {
    const contentDir = await createContentDir()
    // A user-authored line (`.output/`) that coincidentally equals a managed pattern, placed
    // OUTSIDE a complete prior managed block. The marker-bounded merge keeps it in place
    // verbatim instead of stripping it globally and re-emitting it only inside the block.
    const seededGitignore = [
      '.output/',
      '# mdsite: generated state (renderer working dir; runtime artifacts and materialized renderer)',
      '.mdsite/*',
      '.output/',
      '# end mdsite'
    ].join('\n') + '\n'
    await writeFile(path.join(contentDir, '.gitignore'), seededGitignore, 'utf8')

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml, .nvmrc in ${contentDir}.`)

    const gitignoreText = await readFile(path.join(contentDir, '.gitignore'), 'utf8')
    // The user's coincidental `.output/` line is preserved outside the block AND re-emitted inside it,
    // so the pattern now appears exactly twice.
    expect(gitignoreText.split('.output/').length - 1).toBe(2)
    // The managed block is still emitted exactly once.
    expect(gitignoreText.split('# mdsite:').length - 1).toBe(1)
    expect(gitignoreText.split('# end mdsite').length - 1).toBe(1)
    expect(gitignoreText.split('.mdsite/*').length - 1).toBe(1)
  })

  it('runInitCommand recovers from an unterminated managed block (start marker, no end marker)', async () => {
    const contentDir = await createContentDir()
    // Corrupted .gitignore: a managed block missing its end marker (e.g. a truncated prior init).
    const seededGitignore = [
      'secret.env',
      '# mdsite: generated state (renderer working dir; runtime artifacts and materialized renderer)',
      '.mdsite/*',
      '.output/',
      'build/'
    ].join('\n') + '\n'
    await writeFile(path.join(contentDir, '.gitignore'), seededGitignore, 'utf8')

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml, .nvmrc in ${contentDir}.`)

    const gitignoreText = await readFile(path.join(contentDir, '.gitignore'), 'utf8')
    expect(gitignoreText).toContain('secret.env')
    expect(gitignoreText).toContain('build/')
    expect(gitignoreText.split('# mdsite:').length - 1).toBe(1)
    expect(gitignoreText.split('# end mdsite').length - 1).toBe(1)
    expect(gitignoreText.split('.mdsite/*').length - 1).toBe(1)
    expect(gitignoreText.split('.output/').length - 1).toBe(1)
  })

  it('runInitCommand recovers from a dangling end marker (end marker, no start marker)', async () => {
    const contentDir = await createContentDir()
    const seededGitignore = [
      'secret.env',
      '.mdsite/*',
      '.output/',
      '# end mdsite',
      'build/'
    ].join('\n') + '\n'
    await writeFile(path.join(contentDir, '.gitignore'), seededGitignore, 'utf8')

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml, .nvmrc in ${contentDir}.`)

    const gitignoreText = await readFile(path.join(contentDir, '.gitignore'), 'utf8')
    expect(gitignoreText).toContain('secret.env')
    expect(gitignoreText).toContain('build/')
    expect(gitignoreText.split('# mdsite:').length - 1).toBe(1)
    expect(gitignoreText.split('# end mdsite').length - 1).toBe(1)
    expect(gitignoreText.split('.mdsite/*').length - 1).toBe(1)
    expect(gitignoreText.split('.output/').length - 1).toBe(1)
  })

  it('runStartCommand in detached mode prepares the renderer against the current markdown directory and tracks the background process', async () => {
    const contentDir = await createContentDir()
    const rendererDir = await createRendererDir(contentDir)
    const config = await writeConfig(contentDir)
    runBackgroundMock.mockResolvedValueOnce(4321)

    await expect(runStartCommand(contentDir, { detached: true })).resolves.toBe(
      `mdsite live running in background (PID 4321). Log: ${path.join(contentDir, '.renderer', 'live.log')}`
    )

    expect(runBackgroundMock).toHaveBeenCalledWith(
      'npm',
      ['run', 'dev'],
      rendererDir,
      expect.objectContaining({
        NUXT_CONTENT_PATH: contentDir,
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(contentDir, 'mdsite.yml')
      }),
      path.join(contentDir, '.renderer', 'live.log')
    )
    expect(waitForTcpPortMocked).toHaveBeenCalledWith('localhost', 3000)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')

    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toEqual(expect.objectContaining({
      pid: 4321,
      rendererDir,
      contentDir,
      command: ['npm', 'run', 'dev']
    }))
  })

  it('runGenerateCommand writes generated output to the configured destination', async () => {
    const contentDir = await createContentDir()
    const rendererDir = await createRendererDir(contentDir)
    await writeConfig(contentDir, {
      server: {
        output: 'public/site',
        path: '.renderer',
        repo: 'https://github.com/life-and-dev/mdsite',
        gitBranch: 'main'
      }
    })

    runForegroundMock.mockImplementation(async (_command, args, cwd) => {
      if (args[0] === 'run' && args[1] === 'generate') {
        await mkdir(path.join(cwd, '.output', 'public'), { recursive: true })
        await writeFile(path.join(cwd, '.output', 'public', 'index.html'), '<h1>generated</h1>', 'utf8')
      }
    })

    await expect(runGenerateCommand(contentDir)).resolves.toBe(`Generated site synced to ${path.join(contentDir, 'public', 'site', 'public')}`)
    expect(await readFile(path.join(contentDir, 'public', 'site', 'public', 'index.html'), 'utf8')).toBe('<h1>generated</h1>')
    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['run', 'generate'], rendererDir, expect.objectContaining({
      NUXT_CONTENT_PATH: contentDir
    }))
  })

  it('runPreviewCommand works after runGenerateCommand creates only the public artifact', async () => {
    const contentDir = await createContentDir()
    const rendererDir = await createRendererDir(contentDir)
    const config = await writeConfig(contentDir)

    runForegroundMock.mockImplementation(async (_command, args, cwd) => {
      if (args[0] === 'run' && args[1] === 'generate') {
        await mkdir(path.join(cwd, '.output', 'public'), { recursive: true })
        await writeFile(path.join(cwd, '.output', 'public', 'index.html'), '<h1>generated</h1>', 'utf8')
      }
    })

    await expect(runGenerateCommand(contentDir)).resolves.toBe(`Generated site synced to ${path.join(contentDir, '.output', 'public')}`)

    runBackgroundMock.mockResolvedValueOnce(2468)
    stopProcessMock.mockResolvedValueOnce(true)

    await expect(runPreviewCommand(contentDir, { detached: true })).resolves.toBe(
      `mdsite static running in background (PID 2468). URL: http://localhost:3000 Log: ${path.join(contentDir, '.renderer', 'static.log')}`
    )
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')
    await expect(runStopCommand(contentDir)).resolves.toBe('Stopped preview process 2468.')
    await expect(readRuntimeState(contentDir, config, 'preview')).resolves.toBeNull()
  })

  it('auto-runs mdsite init when mdsite.yml is missing before starting', async () => {
    const contentDir = await createContentDir()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(runStartCommand(contentDir)).resolves.toBeUndefined()

    // The embedded init step created mdsite.yml automatically instead of erroring.
    await expect(access(path.join(contentDir, 'mdsite.yml'))).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No mdsite.yml found'))
    consoleSpy.mockRestore()
  })

  it('rejects invalid config files before starting the renderer', async () => {
    const contentDir = await createContentDir()
    const config = await writeConfig(contentDir)

    await writeFile(path.join(contentDir, 'mdsite.yml'), 'site: [broken\n', 'utf8')

    await expect(runStartCommand(contentDir)).rejects.toThrow()
    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toBeNull()
  })

  it('surfaces install failures and does not persist start state', async () => {
    const contentDir = await createContentDir()
    await createRendererDir(contentDir, false)
    const config = await writeConfig(contentDir)
    runForegroundMock.mockRejectedValueOnce(new Error('npm install failed'))

    await expect(runStartCommand(contentDir)).rejects.toThrow('npm install failed')
    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toBeNull()
  })

  it('does not leave tracked start state or logs behind when foreground renderer fails to boot', async () => {
    const contentDir = await createContentDir()
    await createRendererDir(contentDir)
    const config = await writeConfig(contentDir)
    runForegroundMock.mockRejectedValueOnce(new Error('Failed to start npm run dev.'))

    await expect(runStartCommand(contentDir)).rejects.toThrow('Failed to start npm run dev.')
    await expect(readRuntimeState(contentDir, config, 'start')).resolves.toBeNull()
    await expect(access(path.join(contentDir, '.renderer', 'live.json'))).rejects.toThrow()
    await expect(access(path.join(contentDir, '.renderer', 'live.log'))).rejects.toThrow()
  })
})
