import { readFile } from 'node:fs/promises'
import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./commands/init.js', () => ({ runInitCommand: vi.fn() }))
vi.mock('./commands/start.js', () => ({ runStartCommand: vi.fn() }))
vi.mock('./commands/generate.js', () => ({ runGenerateCommand: vi.fn() }))
vi.mock('./commands/preview.js', () => ({ runPreviewCommand: vi.fn() }))
vi.mock('./commands/stop.js', () => ({ runStopCommand: vi.fn() }))
vi.mock('./commands/prepare.js', () => ({ runPrepareGithubCommand: vi.fn() }))

import { runPrepareGithubCommand } from './commands/prepare.js'
import { runPreviewCommand } from './commands/preview.js'
import { runStartCommand } from './commands/start.js'

const runPrepareGithubCommandMock = vi.mocked(runPrepareGithubCommand)
const runPreviewCommandMock = vi.mocked(runPreviewCommand)
const runStartCommandMock = vi.mocked(runStartCommand)

type PackageMetadata = {
  version?: unknown
}

async function readRootPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as PackageMetadata

  if (typeof packageJson.version !== 'string') {
    throw new Error('Unable to read package version from package.json')
  }

  return packageJson.version
}

describe('root CLI entrypoint', () => {
  const originalArgv = process.argv
  const originalExitCode = process.exitCode
  let logSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    process.exitCode = undefined
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.argv = originalArgv
    process.exitCode = originalExitCode
    vi.restoreAllMocks()
  })

  it('prints local-first help output when no command is provided', async () => {
    process.argv = ['node', 'mdsite']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mdsite - local-first CLI for mdsite-nuxt'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('prepare github'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mdsite static|static [-d|--detached]'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('-d, --detached'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('--host [addr]'))
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live in foreground mode by default', async () => {
    process.argv = ['node', 'mdsite', 'start']
    runStartCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false })
    expect(logSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live detached mode for -d', async () => {
    process.argv = ['node', 'mdsite', 'start', '-d']
    runStartCommandMock.mockResolvedValueOnce('detached')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true })
    expect(logSpy).toHaveBeenCalledWith('detached')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live detached mode for --detached', async () => {
    process.argv = ['node', 'mdsite', 'start', '--detached']
    runStartCommandMock.mockResolvedValueOnce('detached')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true })
    expect(logSpy).toHaveBeenCalledWith('detached')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite static in foreground mode by default', async () => {
    process.argv = ['node', 'mdsite', 'preview']
    runPreviewCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPreviewCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false })
    expect(logSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it.each(['-d', '--detached'])('dispatches mdsite static detached mode for %s', async (flag) => {
    process.argv = ['node', 'mdsite', 'preview', flag]
    runPreviewCommandMock.mockResolvedValueOnce('detached preview')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPreviewCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true })
    expect(logSpy).toHaveBeenCalledWith('detached preview')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live with --host exposing the network by default', async () => {
    process.argv = ['node', 'mdsite', 'start', '--host']
    runStartCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false, host: '0.0.0.0' })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live with --host addr using the provided address', async () => {
    process.argv = ['node', 'mdsite', 'start', '--host', '192.168.1.10']
    runStartCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false, host: '192.168.1.10' })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live with -d and --host combined in any order', async () => {
    process.argv = ['node', 'mdsite', 'start', '--host', '-d']
    runStartCommandMock.mockResolvedValueOnce('detached')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true, host: '0.0.0.0' })
    expect(logSpy).toHaveBeenCalledWith('detached')
  })

  it('dispatches mdsite static with --host exposing the network', async () => {
    process.argv = ['node', 'mdsite', 'preview', '--host']
    runPreviewCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPreviewCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false, host: '0.0.0.0' })
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live as an alias of mdsite live in foreground mode by default', async () => {
    process.argv = ['node', 'mdsite', 'live']
    runStartCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false })
    expect(logSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite live detached mode for -d', async () => {
    process.argv = ['node', 'mdsite', 'live', '-d']
    runStartCommandMock.mockResolvedValueOnce('detached')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runStartCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true })
    expect(logSpy).toHaveBeenCalledWith('detached')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite static as an alias of mdsite static in foreground mode by default', async () => {
    process.argv = ['node', 'mdsite', 'static']
    runPreviewCommandMock.mockResolvedValue(undefined)

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPreviewCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: false })
    expect(logSpy).not.toHaveBeenCalled()
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite static detached mode for -d', async () => {
    process.argv = ['node', 'mdsite', 'static', '-d']
    runPreviewCommandMock.mockResolvedValueOnce('detached preview')

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPreviewCommandMock).toHaveBeenCalledWith(process.cwd(), { detached: true })
    expect(logSpy).toHaveBeenCalledWith('detached preview')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('rejects unknown options for mdsite live as errors', async () => {
    process.argv = ['node', 'mdsite', 'start', '--bogus']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errorSpy).toHaveBeenCalledWith('Error: Unsupported option: --bogus. Run `mdsite help` for supported options.')
    expect(process.exitCode).toBe(1)
  })

  it.each(['help', '-h', '--help'])('prints help output when %s is requested', async (helpCommand) => {
    process.argv = ['node', 'mdsite', helpCommand]

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('prepare github'))
    expect(errorSpy).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it('prints the package version when the version command is requested', async () => {
    process.argv = ['node', 'mdsite', 'version']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logSpy).toHaveBeenCalledWith(await readRootPackageVersion())
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('dispatches mdsite prepare github to the GitHub workflow command', async () => {
    process.argv = ['node', 'mdsite', 'prepare', 'github']
    runPrepareGithubCommandMock.mockResolvedValue(
      'Generated GitHub Pages workflow at /workspace/content/.github/workflows/deploy.yml'
    )

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runPrepareGithubCommandMock).toHaveBeenCalledWith(process.cwd())
    expect(logSpy).toHaveBeenCalledWith('Generated GitHub Pages workflow at /workspace/content/.github/workflows/deploy.yml')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('rejects mdsite prepare without github as unsupported', async () => {
    process.argv = ['node', 'mdsite', 'prepare']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Unsupported command: prepare. Run `mdsite help` for supported local commands.'
    )
    expect(process.exitCode).toBe(1)
  })

  it('reports unsupported commands as errors and sets a non-zero exit code', async () => {
    process.argv = ['node', 'mdsite', 'wat']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Unsupported command: wat. Run `mdsite help` for supported local commands.'
    )
    expect(process.exitCode).toBe(1)
  })
})
