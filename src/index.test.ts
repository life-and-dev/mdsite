import process from 'node:process'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./commands/init.js', () => ({ runInitCommand: vi.fn() }))
vi.mock('./commands/start.js', () => ({ runStartCommand: vi.fn() }))
vi.mock('./commands/generate.js', () => ({ runGenerateCommand: vi.fn() }))
vi.mock('./commands/preview.js', () => ({ runPreviewCommand: vi.fn() }))
vi.mock('./commands/stop.js', () => ({ runStopCommand: vi.fn() }))
vi.mock('./commands/prepare.js', () => ({ runPrepareGithubCommand: vi.fn() }))

import { runPrepareGithubCommand } from './commands/prepare.js'

const runPrepareGithubCommandMock = vi.mocked(runPrepareGithubCommand)

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
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mdsite preview'))
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('prints help output when the help command is requested', async () => {
    process.argv = ['node', 'mdsite', 'help']

    await import('./index.js')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('prepare github'))
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
