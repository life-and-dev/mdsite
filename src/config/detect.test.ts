import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { detectCanonicalUrl, detectFavicon, detectInputPath, detectSourceEditUrl } from './detect.js'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-detect-'))
  tempDirs.push(dir)
  return dir
}

async function writeGitConfig(dir: string, config: string): Promise<void> {
  await mkdir(path.join(dir, '.git'), { recursive: true })
  await writeFile(path.join(dir, '.git', 'config'), config, 'utf8')
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => import('node:fs/promises').then(({ rm }) => rm(dir, { recursive: true, force: true })))
  )
})

describe('detectFavicon', () => {
  it('returns the top-level favicon when present', async () => {
    const dir = await makeTempDir()
    await writeFile(path.join(dir, 'favicon.ico'), 'x', 'utf8')

    await expect(detectFavicon(dir)).resolves.toBe('favicon.ico')
  })

  it('prefers a top-level match over a nested one', async () => {
    const dir = await makeTempDir()
    await mkdir(path.join(dir, 'docs'), { recursive: true })
    await writeFile(path.join(dir, 'docs', 'logo.png'), 'x', 'utf8')
    await writeFile(path.join(dir, 'favicon.ico'), 'x', 'utf8')

    await expect(detectFavicon(dir)).resolves.toBe('favicon.ico')
  })

  it('finds a nested favicon when none exists at top level', async () => {
    const dir = await makeTempDir()
    await mkdir(path.join(dir, 'docs', 'img'), { recursive: true })
    await writeFile(path.join(dir, 'docs', 'img', 'logo.webp'), 'x', 'utf8')

    await expect(detectFavicon(dir)).resolves.toBe('docs/img/logo.webp')
  })

  it('ignores non-matching names and extensions', async () => {
    const dir = await makeTempDir()
    await writeFile(path.join(dir, 'icon.svg'), 'x', 'utf8')
    await writeFile(path.join(dir, 'favicons.txt'), 'x', 'utf8')
    await writeFile(path.join(dir, 'readme.md'), 'x', 'utf8')

    await expect(detectFavicon(dir)).resolves.toBe('')
  })

  it('returns blank when no favicon exists', async () => {
    const dir = await makeTempDir()
    await writeFile(path.join(dir, 'index.md'), '# Hi', 'utf8')

    await expect(detectFavicon(dir)).resolves.toBe('')
  })
})

describe('detectInputPath', () => {
  it('prefers docs over doc', async () => {
    const dir = await makeTempDir()
    await mkdir(path.join(dir, 'docs'), { recursive: true })
    await mkdir(path.join(dir, 'doc'), { recursive: true })

    await expect(detectInputPath(dir)).resolves.toBe('docs')
  })

  it('returns doc when only doc exists', async () => {
    const dir = await makeTempDir()
    await mkdir(path.join(dir, 'doc'), { recursive: true })

    await expect(detectInputPath(dir)).resolves.toBe('doc')
  })

  it('returns blank when neither exists', async () => {
    const dir = await makeTempDir()

    await expect(detectInputPath(dir)).resolves.toBe('')
  })

  it('ignores a file named docs', async () => {
    const dir = await makeTempDir()
    await writeFile(path.join(dir, 'docs'), 'not a dir', 'utf8')

    await expect(detectInputPath(dir)).resolves.toBe('')
  })
})

describe('detectSourceEditUrl', () => {
  it('builds a github edit URL from an SSH remote and current branch', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = git@github.com:owner/repo.git\n')
    await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')

    await expect(detectSourceEditUrl(dir)).resolves.toBe('https://github.com/owner/repo/blob/main/')
  })

  it('builds a github edit URL from an HTTPS remote', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = https://github.com/owner/repo.git\n')
    await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/develop\n', 'utf8')

    await expect(detectSourceEditUrl(dir)).resolves.toBe('https://github.com/owner/repo/blob/develop/')
  })

  it('returns blank for a non-github remote', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = git@gitlab.com:owner/repo.git\n')
    await writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')

    await expect(detectSourceEditUrl(dir)).resolves.toBe('')
  })

  it('returns blank on a detached HEAD', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = git@github.com:owner/repo.git\n')
    await writeFile(path.join(dir, '.git', 'HEAD'), '0123456789abcdef0123456789abcdef01234567\n', 'utf8')

    await expect(detectSourceEditUrl(dir)).resolves.toBe('')
  })

  it('returns blank when git metadata is missing', async () => {
    const dir = await makeTempDir()

    await expect(detectSourceEditUrl(dir)).resolves.toBe('')
  })
})

describe('detectCanonicalUrl', () => {
  it('builds a github pages URL from an SSH remote', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = git@github.com:owner/repo.git\n')

    await expect(detectCanonicalUrl(dir)).resolves.toBe('https://owner.github.io/repo')
  })

  it('builds a github pages URL from an HTTPS remote', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = https://github.com/owner/repo.git\n')

    await expect(detectCanonicalUrl(dir)).resolves.toBe('https://owner.github.io/repo')
  })

  it('returns blank for a non-github remote', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = git@gitlab.com:owner/repo.git\n')

    await expect(detectCanonicalUrl(dir)).resolves.toBe('')
  })

  it('returns blank when git metadata is missing', async () => {
    const dir = await makeTempDir()

    await expect(detectCanonicalUrl(dir)).resolves.toBe('')
  })

  it('never throws on unparseable input (returns blank)', async () => {
    const dir = await makeTempDir()
    await writeGitConfig(dir, '[remote "origin"]\n\turl = not-a-valid-url\n')

    await expect(detectCanonicalUrl(dir)).resolves.toBe('')
  })
})
