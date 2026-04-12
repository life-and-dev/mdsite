import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  onMock,
  prepareRendererRuntimeMock,
  runSetupHooksMock,
  spawnMock,
} = vi.hoisted(() => ({
  onMock: vi.fn(),
  prepareRendererRuntimeMock: vi.fn(),
  runSetupHooksMock: vi.fn(),
  spawnMock: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: spawnMock,
}))

vi.mock('./renderer-hooks.js', () => ({
  prepareRendererRuntime: prepareRendererRuntimeMock,
  runSetupHooks: runSetupHooksMock,
}))

describe('renderer start wrapper', () => {
  const originalArgv = [...process.argv]
  const originalEnv = { ...process.env }
  const rootDir = path.resolve(process.cwd())

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    process.argv = originalArgv.slice(0, 2)
    process.env = { ...originalEnv }

    runSetupHooksMock.mockResolvedValue(undefined)
    prepareRendererRuntimeMock.mockReturnValue(undefined)
    spawnMock.mockReturnValue({ on: onMock })
  })

  async function importStartWithArgs(args: string[]) {
    process.argv = ['node', 'scripts/start.ts', ...args]
    await import('./start.ts')
  }

  it('wraps default dev startup through runSetupHooks before spawning nuxt dev', async () => {
    await importStartWithArgs([])

    expect(runSetupHooksMock).toHaveBeenCalledWith('dev', rootDir, {
      cached: false,
      configPath: undefined,
    })
    expect(prepareRendererRuntimeMock).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledWith('npx', ['nuxt', 'dev'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
    })
  })

  it('keeps cached dev startup on the same wrapper contract while switching the nuxt command', async () => {
    await importStartWithArgs(['--cached'])

    expect(runSetupHooksMock).toHaveBeenCalledWith('dev', rootDir, {
      cached: true,
      configPath: undefined,
    })
    expect(spawnMock).toHaveBeenCalledWith('npx', ['nuxt', 'dev:cached'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
    })
  })

  it('routes generate through setup hooks before spawning nuxt generate', async () => {
    await importStartWithArgs(['--generate', 'config/site.yml'])

    expect(runSetupHooksMock).toHaveBeenCalledWith('generate', rootDir, {
      configPath: 'config/site.yml',
    })
    expect(spawnMock).toHaveBeenCalledWith('npx', ['nuxt', 'generate'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
    })
  })

  it('routes build through setup hooks before spawning nuxt build', async () => {
    await importStartWithArgs(['--build', 'config/site.yml'])

    expect(runSetupHooksMock).toHaveBeenCalledWith('build', rootDir, {
      configPath: 'config/site.yml',
    })
    expect(prepareRendererRuntimeMock).not.toHaveBeenCalled()
    expect(spawnMock).toHaveBeenCalledWith('npx', ['nuxt', 'build'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
    })
  })

  it('routes preview through the renderer runtime wrapper before spawning nuxt preview', async () => {
    await importStartWithArgs(['--preview', 'config/site.yml'])

    expect(prepareRendererRuntimeMock).toHaveBeenCalledWith(rootDir, {
      configPath: 'config/site.yml',
    })
    expect(runSetupHooksMock).not.toHaveBeenCalled()
    expect(process.env.MDSITE_RENDERER_ORCHESTRATED).toBe('1')
    expect(spawnMock).toHaveBeenCalledWith('npx', ['nuxt', 'preview'], {
      cwd: rootDir,
      env: process.env,
      stdio: 'inherit',
    })
  })

  it('supports the explicit prepare hook without spawning nuxt', async () => {
    const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`process.exit(${code ?? 0})`)
    })

    await expect(importStartWithArgs(['--prepare', 'config/site.yml'])).rejects.toThrow('process.exit(0)')

    expect(runSetupHooksMock).toHaveBeenCalledWith('setup', rootDir, {
      configPath: 'config/site.yml',
    })
    expect(spawnMock).not.toHaveBeenCalled()

    processExitSpy.mockRestore()
  })

  it('exposes stable CLI-facing script names in package.json', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

    expect(packageJson.scripts).toMatchObject({
      build: 'tsx scripts/start.ts --build',
      'build:renderer': 'npm run build',
      dev: 'tsx scripts/start.ts',
      'dev:cached': 'tsx scripts/start.ts --cached',
      generate: 'tsx scripts/start.ts --generate',
      'prepare:renderer': 'tsx scripts/start.ts --prepare',
      preview: 'tsx scripts/start.ts --preview',
      setup: 'npm run prepare:renderer',
      'sync-content': 'tsx scripts/sync-content.ts --sync',
      'generate-indices': 'tsx scripts/generate-indices.ts',
      'generate-favicons': 'npm run favicon',
    })
  })

  it('exposes normalized backend hook script aliases in package.json', () => {
    const packageJson = JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'))

    expect(packageJson.scripts).toMatchObject({
      'build:renderer': 'npm run build',
      'prepare:renderer': 'tsx scripts/start.ts --prepare',
      'prepare:nuxt': 'nuxt prepare',
      setup: 'npm run prepare:renderer',
      start: 'tsx scripts/start.ts',
    })
  })
})
