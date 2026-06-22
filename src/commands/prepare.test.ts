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

  it('reads _mdsite.yml, uses the configured renderer path, and writes the GitHub Pages workflow', async () => {
    const contentDir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-prepare-'))
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
    expect(workflow).toContain('MDSITE_CONFIG_PATH: "${{ github.workspace }}/_mdsite.yml"')
    expect(workflow).toContain('cache-dependency-path: "renderer/package-lock.json"')
    expect(workflow).toContain('path: "./build/site/public"')
    expect(workflow).toContain('actions/upload-pages-artifact@v3')
    expect(workflow).toContain('actions/deploy-pages@v4')

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
