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
    runForegroundMock.mockImplementation(async (command, args) => {
      if (command === 'git' && args[0] === 'clone') {
        await mkdir(args[2], { recursive: true })
      }
    })
  })

  afterEach(async () => {
    for (const tempDir of tempDirs.splice(0)) {
      await rm(tempDir, { force: true, recursive: true })
    }
  })

  it('clones a missing configured renderer, prepares it, and writes the root CLI GitHub Pages workflow', async () => {
    const contentDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-'))
    tempDirs.push(contentDir)

    const rendererDir = path.join(contentDir, 'renderer')
    await writeFile(
      path.join(contentDir, '_mdsite.yml'),
      [
        'site:',
        '  name: Example Docs',
        'server:',
        '  path: renderer',
        '  output: build/site',
        '  repo: https://example.com/custom-renderer.git',
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
    expect(workflow).not.toContain('working-directory: renderer')
    expect(workflow).toContain('NUXT_APP_BASE_URL: ${{ steps.pages.outputs.base_path }}')
    expect(workflow).toContain('cache-dependency-path: package-lock.json')
    expect(workflow).toContain('run: npm ci')
    expect(workflow).toContain('run: npm run build')
    expect(workflow).toContain('run: node dist/index.js generate')
    expect(workflow).toContain('path: "./build/site"')
    expect(workflow).not.toContain('./build/site/public')
    expect(workflow).toContain('actions/upload-pages-artifact@v3')
    expect(workflow).toContain('actions/deploy-pages@v4')

    expect(runForegroundMock).toHaveBeenNthCalledWith(
      1,
      'git',
      ['clone', 'https://example.com/custom-renderer.git', rendererDir],
      process.cwd(),
      process.env
    )
    expect(runForegroundMock).toHaveBeenNthCalledWith(
      2,
      'npm',
      ['install'],
      rendererDir,
      process.env
    )
    expect(runForegroundMock).toHaveBeenNthCalledWith(
      3,
      'npm',
      ['run', 'prepare:renderer'],
      rendererDir,
      expect.objectContaining({
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(contentDir, '_mdsite.yml'),
        NUXT_CONTENT_PATH: contentDir
      })
    )
  })

  it('reuses an existing configured renderer checkout without clone refresh commands', async () => {
    const contentDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-existing-'))
    tempDirs.push(contentDir)

    const rendererDir = path.join(contentDir, 'renderer')
    await mkdir(path.join(rendererDir, 'node_modules'), { recursive: true })
    await writeFile(
      path.join(contentDir, '_mdsite.yml'),
      [
        'site:',
        '  name: Example Docs',
        'server:',
        '  path: renderer',
        '  output: .output/public',
        '  repo: https://example.com/custom-renderer.git',
        ''
      ].join('\n'),
      'utf8'
    )
    await writeFile(path.join(contentDir, 'index.md'), '# Example Docs\n', 'utf8')

    await runPrepareGithubCommand(contentDir)

    expect(runForegroundMock).toHaveBeenCalledTimes(1)
    expect(runForegroundMock).toHaveBeenCalledWith(
      'npm',
      ['run', 'prepare:renderer'],
      rendererDir,
      expect.objectContaining({
        CONTENT_DIR: contentDir,
        MDSITE_CONFIG_PATH: path.join(contentDir, '_mdsite.yml'),
        NUXT_CONTENT_PATH: contentDir
      })
    )
  })
})
