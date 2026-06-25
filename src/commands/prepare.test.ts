import os from 'node:os'
import path from 'node:path'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../process/child-process.js', () => ({
  runBackground: vi.fn(),
  runForeground: vi.fn()
}))

import { runForeground } from '../process/child-process.js'
import { runPrepareGithubCommand } from './prepare.js'

const runForegroundMock = vi.mocked(runForeground)

describe('runPrepareGithubCommand', () => {
  const tempDirs: string[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    runForegroundMock.mockResolvedValue(undefined)
  })

  afterEach(async () => {
    for (const tempDir of tempDirs.splice(0)) {
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('reads mdsite.yml, generates in the configured renderer path, and writes the GitHub Pages workflow', async () => {
    const contentDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-'))
    tempDirs.push(contentDir)

    const rendererDir = path.join(contentDir, 'renderer')
    await mkdir(path.join(rendererDir, 'node_modules'), { recursive: true })
    await writeFile(
      path.join(contentDir, 'mdsite.yml'),
      [
        'site:',
        '  name: Example Docs',
        'server:',
        '  path: renderer',
        '  output: build/site',
        ''
      ].join('\n'),
      'utf8'
    )
    await writeFile(path.join(contentDir, 'index.md'), '# Example Docs\n', 'utf8')
    await writeFile(path.join(contentDir, 'guide.md'), '# Guide\n', 'utf8')

    const result = await runPrepareGithubCommand(contentDir)
    const workflowPath = path.join(contentDir, '.github', 'workflows', 'deploy.yml')
    const workflow = await readFile(workflowPath, 'utf8')

    expect(result).toBe(`Generated GitHub Pages workflow at ${workflowPath}`)
    expect(workflow).toContain('name: "Deploy Example Docs to GitHub Pages"')
    expect(workflow).toContain('runs-on: ubuntu-latest')
    expect(workflow).toContain('working-directory: renderer')
    expect(workflow).toContain('NUXT_APP_BASE_URL: ${{ steps.pages.outputs.base_path }}')
    expect(workflow).toContain('NUXT_CONTENT_PATH: "${{ github.workspace }}"')
    expect(workflow).toContain('CONTENT_DIR: "${{ github.workspace }}"')
    expect(workflow).toContain('MDSITE_CONFIG_PATH: "${{ github.workspace }}/mdsite.yml"')
    expect(workflow).toContain('cache-dependency-path: "renderer/package-lock.json"')
    expect(workflow).toContain('name: Setup mdsite renderer')
    expect(workflow).toContain('npm install --no-save mdsite')
    expect(workflow).toContain("node_modules', 'mdsite', 'mdsite-nuxt")
    expect(workflow).toContain('renderer/build/site')
    expect(workflow).toContain('path: "./renderer/build/site/public"')
    expect(workflow).toContain('run: npm run generate')
    expect(workflow).not.toContain('npm start -- --generate')
    expect(workflow).toContain('actions/upload-pages-artifact@v3')
    expect(workflow).toContain('actions/deploy-pages@v4')

    expect(runForegroundMock).toHaveBeenCalledTimes(1)
    expect(runForegroundMock).toHaveBeenCalledWith(
      'npm',
      ['run', 'prepare:renderer'],
      rendererDir,
      expect.objectContaining({
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(contentDir, 'mdsite.yml'),
        NUXT_CONTENT_PATH: contentDir
      })
    )
  })

  it('writes GitHub workflow paths for a root config with content.path', async () => {
    const configDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-'))
    tempDirs.push(configDir)

    const contentDir = path.join(configDir, 'docs')
    const rendererDir = path.join(configDir, 'renderer')
    await mkdir(path.join(contentDir), { recursive: true })
    await mkdir(path.join(rendererDir, 'node_modules'), { recursive: true })
    await writeFile(
      path.join(configDir, 'mdsite.yml'),
      [
        'content:',
        '  path: docs',
        'site:',
        '  name: Root Docs',
        'server:',
        '  path: renderer',
        '  output: build/site',
        ''
      ].join('\n'),
      'utf8'
    )
    await writeFile(path.join(contentDir, 'index.md'), '# Root Docs\n', 'utf8')

    await runPrepareGithubCommand(configDir)
    const workflow = await readFile(path.join(configDir, '.github', 'workflows', 'deploy.yml'), 'utf8')

    expect(workflow).toContain('NUXT_CONTENT_PATH: "${{ github.workspace }}/docs"')
    expect(workflow).toContain('CONTENT_DIR: "${{ github.workspace }}/docs"')
    expect(workflow).toContain('MDSITE_CONFIG_PATH: "${{ github.workspace }}/mdsite.yml"')
    expect(workflow).toContain('working-directory: renderer')
    expect(workflow).toContain('run: npm run generate')
    expect(workflow).not.toContain('npm start -- --generate')
    expect(workflow).toContain('path: "./renderer/build/site/public"')
    expect(runForegroundMock).toHaveBeenCalledWith(
      'npm',
      ['run', 'prepare:renderer'],
      rendererDir,
      expect.objectContaining({
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(configDir, 'mdsite.yml'),
        NUXT_CONTENT_PATH: contentDir
      })
    )
  })

  it('creates the configured renderer before preparing the GitHub workflow', async () => {
    const contentDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-'))
    tempDirs.push(contentDir)

    const rendererDir = path.join(contentDir, '.mdsite')
    await writeFile(
      path.join(contentDir, 'mdsite.yml'),
      [
        'site:',
        '  name: Default Renderer Docs',
        'server:',
        '  path: .mdsite',
        '  output: .output',
        ''
      ].join('\n'),
      'utf8'
    )
    await writeFile(path.join(contentDir, 'index.md'), '# Default Renderer Docs\n', 'utf8')

    await runPrepareGithubCommand(contentDir)
    const workflow = await readFile(path.join(contentDir, '.github', 'workflows', 'deploy.yml'), 'utf8')

    expect(await readFile(path.join(rendererDir, 'package.json'), 'utf8')).toContain('mdsite-nuxt')
    expect(workflow).toContain('working-directory: .mdsite')
    expect(workflow).toContain('cache-dependency-path: ".mdsite/package-lock.json"')
    expect(workflow).toContain('path: "./.mdsite/.output/public"')
    expect(workflow).toContain('run: npm run generate')
    expect(workflow).not.toContain('npm start -- --generate')
    expect(runForegroundMock).toHaveBeenCalledWith('npm', ['ci'], rendererDir, process.env)
    expect(runForegroundMock).toHaveBeenCalledWith(
      'npm',
      ['run', 'prepare:renderer'],
      rendererDir,
      expect.objectContaining({
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(contentDir, 'mdsite.yml'),
        NUXT_CONTENT_PATH: contentDir
      })
    )
  })
})
