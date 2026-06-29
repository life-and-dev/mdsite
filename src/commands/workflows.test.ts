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

import { serializeMdsiteConfig, type MdsiteConfig } from '../config/mdsite-config.js'
import { openUrlInBrowser, stopProcess, waitForTcpPort, runBackground, runForeground } from '../process/child-process.js'
import { readRuntimeState } from '../process/runtime-state.js'
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
    server: {
      output: '.output',
      path: '.renderer',
      repo: 'https://github.com/life-and-dev/mdsite',
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
  })

  it('runInitCommand creates a valid mdsite.yml and pins Node 24 via .nvmrc', async () => {
    const contentDir = await createContentDir()

    await expect(runInitCommand(contentDir)).resolves.toBe(`Created mdsite.yml and .nvmrc in ${contentDir}`)

    const configPath = path.join(contentDir, 'mdsite.yml')
    const configText = await readFile(configPath, 'utf8')
    expect(configText).toContain('name: Workspace Docs')
    expect(configText).toContain('output: .output')
    expect(configText).toContain('- docs/guide')

    const nvmrcPath = path.join(contentDir, '.nvmrc')
    const nvmrcText = await readFile(nvmrcPath, 'utf8')
    expect(nvmrcText).toBe('24\n')
  })

  it('runStartCommand in detached mode prepares the renderer against the current markdown directory and tracks the background process', async () => {
    const contentDir = await createContentDir()
    const rendererDir = await createRendererDir(contentDir)
    await writeConfig(contentDir)
    runBackgroundMock.mockResolvedValueOnce(4321)

    await expect(runStartCommand(contentDir, { detached: true })).resolves.toBe(
      `mdsite start running in background (PID 4321). Log: ${path.join(contentDir, '.mdsite-runtime', 'start.log')}`
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
      path.join(contentDir, '.mdsite-runtime', 'start.log')
    )
    expect(waitForTcpPortMocked).toHaveBeenCalledWith('localhost', 3000)
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')

    expect(await readFile(path.join(rendererDir, '.env'), 'utf8')).toContain(`NUXT_CONTENT_PATH=${JSON.stringify(contentDir)}`)
    expect(await readFile(path.join(rendererDir, 'content.config.yml'), 'utf8')).toContain('siteName: Workspace Docs')
    await expect(readRuntimeState(contentDir, 'start')).resolves.toEqual(expect.objectContaining({
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
        repo: 'https://github.com/life-and-dev/mdsite'
      }
    })

    runForegroundMock.mockImplementation(async (_command, args, cwd) => {
      if (args[0] === 'run' && args[1] === 'generate') {
        await mkdir(path.join(cwd, '.output', 'public'), { recursive: true })
        await writeFile(path.join(cwd, '.output', 'public', 'index.html'), '<h1>generated</h1>', 'utf8')
      }
    })

    await expect(runGenerateCommand(contentDir)).resolves.toBe(`Generated site synced to ${path.join(contentDir, 'public', 'site')}`)
    expect(await readFile(path.join(contentDir, 'public', 'site', 'index.html'), 'utf8')).toBe('<h1>generated</h1>')
    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['run', 'generate'], rendererDir, expect.objectContaining({
      NUXT_CONTENT_PATH: contentDir
    }))
  })

  it('runPreviewCommand works after runGenerateCommand creates only the public artifact', async () => {
    const contentDir = await createContentDir()
    const rendererDir = await createRendererDir(contentDir)
    await writeConfig(contentDir)

    runForegroundMock.mockImplementation(async (_command, args, cwd) => {
      if (args[0] === 'run' && args[1] === 'generate') {
        await mkdir(path.join(cwd, '.output', 'public'), { recursive: true })
        await writeFile(path.join(cwd, '.output', 'public', 'index.html'), '<h1>generated</h1>', 'utf8')
      }
    })

    await expect(runGenerateCommand(contentDir)).resolves.toBe(`Generated site synced to ${path.join(contentDir, '.output')}`)

    runBackgroundMock.mockResolvedValueOnce(2468)
    stopProcessMock.mockResolvedValueOnce(true)

    await expect(runPreviewCommand(contentDir, { detached: true })).resolves.toBe(
      `mdsite preview running in background (PID 2468). URL: http://localhost:3000 Log: ${path.join(contentDir, 'mdsite.log')}`
    )
    expect(openUrlInBrowserMock).toHaveBeenCalledWith('http://localhost:3000')
    await expect(runStopCommand(contentDir)).resolves.toBe('Stopped preview process 2468.')
    await expect(readRuntimeState(contentDir, 'preview')).resolves.toBeNull()
  })

  it('rejects start when mdsite.yml is missing', async () => {
    const contentDir = await createContentDir()

    await expect(runStartCommand(contentDir)).rejects.toThrow(
      `Missing mdsite.yml in ${contentDir}. Run \`mdsite init\` first.`
    )
  })

  it('rejects invalid config files before starting the renderer', async () => {
    const contentDir = await createContentDir()
    await writeFile(path.join(contentDir, 'mdsite.yml'), 'site: [broken\n', 'utf8')

    await expect(runStartCommand(contentDir)).rejects.toThrow()
    await expect(readRuntimeState(contentDir, 'start')).resolves.toBeNull()
  })

  it('surfaces install failures and does not persist start state', async () => {
    const contentDir = await createContentDir()
    await createRendererDir(contentDir, false)
    await writeConfig(contentDir)
    runForegroundMock.mockRejectedValueOnce(new Error('npm install failed'))

    await expect(runStartCommand(contentDir)).rejects.toThrow('npm install failed')
    await expect(readRuntimeState(contentDir, 'start')).resolves.toBeNull()
  })

  it('does not leave tracked start state or logs behind when foreground renderer fails to boot', async () => {
    const contentDir = await createContentDir()
    await createRendererDir(contentDir)
    await writeConfig(contentDir)
    runForegroundMock.mockRejectedValueOnce(new Error('Failed to start npm run dev.'))

    await expect(runStartCommand(contentDir)).rejects.toThrow('Failed to start npm run dev.')
    await expect(readRuntimeState(contentDir, 'start')).resolves.toBeNull()
    await expect(access(path.join(contentDir, '.mdsite-runtime', 'start.json'))).rejects.toThrow()
    await expect(access(path.join(contentDir, '.mdsite-runtime', 'start.log'))).rejects.toThrow()
  })
})
