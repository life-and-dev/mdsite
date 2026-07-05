import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { deriveSiteName, generateMenuFromMarkdownFiles } from './menu.js'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-menu-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(async (dir) => import('node:fs/promises').then(({ rm }) => rm(dir, { recursive: true, force: true }))))
})

describe('menu helpers', () => {
  it('derives the site name from the first H1 in README.md', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'README.md'), 'Intro\n#  Example Site  \n## More\n', 'utf8')

    await expect(deriveSiteName(contentDir)).resolves.toBe('Example Site')
  })

  it('falls back to index.md when README.md is missing or lacks an H1', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Index Title', 'utf8')

    await expect(deriveSiteName(contentDir)).resolves.toBe('Index Title')
  })

  it('returns blank when neither README.md nor index.md has an H1', async () => {
    const missingDir = await makeTempDir()
    const noHeadingDir = await makeTempDir()
    await writeFile(path.join(noHeadingDir, 'README.md'), '## Not the site name', 'utf8')

    await expect(deriveSiteName(missingDir)).resolves.toBe('')
    await expect(deriveSiteName(noHeadingDir)).resolves.toBe('')
  })

  it('generates a sorted extensionless menu from markdown files and ignores runtime/build entries', async () => {
    const contentDir = await makeTempDir()

    await mkdir(path.join(contentDir, 'guides', 'nested'), { recursive: true })
    await mkdir(path.join(contentDir, 'node_modules'), { recursive: true })
    await mkdir(path.join(contentDir, '.git'), { recursive: true })
    await mkdir(path.join(contentDir, '.hidden'), { recursive: true })
    await mkdir(path.join(contentDir, '.output'), { recursive: true })

    await Promise.all([
      writeFile(path.join(contentDir, 'index.md'), '# Home', 'utf8'),
      writeFile(path.join(contentDir, 'about.md'), '# About', 'utf8'),
      writeFile(path.join(contentDir, 'guides', 'alpha.md'), '# Alpha', 'utf8'),
      writeFile(path.join(contentDir, 'guides', 'nested', 'beta.md'), '# Beta', 'utf8'),
      writeFile(path.join(contentDir, '_menu.yml'), '[]', 'utf8'),
      writeFile(path.join(contentDir, 'notes.txt'), 'ignore', 'utf8'),
      writeFile(path.join(contentDir, 'node_modules', 'skip.md'), '# Skip', 'utf8'),
      writeFile(path.join(contentDir, '.hidden', 'secret.md'), '# Skip', 'utf8'),
      writeFile(path.join(contentDir, '.output', 'built.md'), '# Skip', 'utf8')
    ])

    await expect(generateMenuFromMarkdownFiles(contentDir)).resolves.toEqual([
      'about',
      'guides/alpha',
      'guides/nested/beta'
    ])
  })

  it('excludes repo-meta markdown (README, AGENTS, LICENSE, CONTRIBUTING, SECURITY) from the menu', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'README.md'), '# Readme', 'utf8')
    await writeFile(path.join(contentDir, 'AGENTS.md'), '# Agents', 'utf8')
    await writeFile(path.join(contentDir, 'LICENSE.md'), '# License', 'utf8')
    await writeFile(path.join(contentDir, 'CONTRIBUTING.md'), '# Contributing', 'utf8')
    await writeFile(path.join(contentDir, 'SECURITY.md'), '# Security', 'utf8')
    await writeFile(path.join(contentDir, 'about.md'), '# About', 'utf8')
    await writeFile(path.join(contentDir, 'guide.md'), '# Guide', 'utf8')

    await expect(generateMenuFromMarkdownFiles(contentDir)).resolves.toEqual(['about', 'guide'])
  })
})
