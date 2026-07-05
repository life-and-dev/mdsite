import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ignoredDirectories = new Set([
  '.git',
  '.mdsite',
  '.output',
  'dist',
  'mdsite-nuxt',
  'node_modules'
])

const faviconBasenames = ['favicon', 'logo']
const faviconExtensions = ['webp', 'jpg', 'png', 'ico']

/**
 * Breadth-first scan of `contentDir` (top-level first) for the first file
 * whose basename is `favicon` or `logo` with a `.webp`/`.jpg`/`.png`/`.ico`
 * extension. At each directory level, matching files are sorted alphabetically
 * and the first wins (so `favicon.ico` is preferred over `logo.png` at the
 * same depth). Returns the match path relative to `contentDir` with forward
 * slashes, or `''` when nothing matches.
 */
export async function detectFavicon(contentDir: string): Promise<string> {
  const queue: string[] = [contentDir]

  while (queue.length > 0) {
    const currentDir = queue.shift() as string

    let entries
    try {
      entries = await readdir(currentDir, { withFileTypes: true })
    } catch {
      continue
    }

    const matches: string[] = []
    for (const entry of entries) {
      if (!entry.isFile()) continue
      const ext = path.extname(entry.name).toLowerCase().replace(/^\./, '')
      const base = path.basename(entry.name, path.extname(entry.name)).toLowerCase()
      if (faviconBasenames.includes(base) && faviconExtensions.includes(ext)) {
        matches.push(entry.name)
      }
    }

    if (matches.length > 0) {
      matches.sort((left, right) => left.localeCompare(right))
      const relative = path.relative(contentDir, path.join(currentDir, matches[0]))
      return relative.split(path.sep).join('/')
    }

    const subdirs = entries
      .filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name) && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right))

    for (const name of subdirs) {
      queue.push(path.join(currentDir, name))
    }
  }

  return ''
}

/**
 * Build a GitHub "edit" URL prefix from local git metadata. Reads
 * `<contentDir>/.git/config` for the `origin` remote URL and
 * `<contentDir>/.git/HEAD` for the current branch, then returns
 * `https://github.com/<owner>/<repo>/blob/<branch>/`. Returns `''` when the
 * remote is not GitHub, the branch can't be determined (e.g. detached HEAD),
 * or the git metadata is missing.
 */
export async function detectSourceEditUrl(contentDir: string): Promise<string> {
  const remoteUrl = await readOriginRemoteUrl(contentDir)
  if (!remoteUrl) return ''

  const repoPath = parseGitHubRepoPath(remoteUrl)
  if (!repoPath) return ''

  const branch = await readCurrentBranch(contentDir)
  if (!branch) return ''

  return `https://github.com/${repoPath}/blob/${branch}/`
}

/**
 * Guess a GitHub Pages canonical URL from local git metadata. Reads
 * `<contentDir>/.git/config` for the `origin` remote URL and builds
 * `https://<owner>.github.io/<repo>` from the GitHub owner/repo. Returns `''`
 * when the remote is not GitHub, the git metadata is missing, or anything
 * else goes wrong (never throws).
 */
export async function detectCanonicalUrl(contentDir: string): Promise<string> {
  try {
    const remoteUrl = await readOriginRemoteUrl(contentDir)
    if (!remoteUrl) return ''

    const repoPath = parseGitHubRepoPath(remoteUrl)
    if (!repoPath) return ''

    const [owner, repo] = repoPath.split('/')
    if (!owner || !repo) return ''

    return `https://${owner}.github.io/${repo}`
  } catch {
    return ''
  }
}

/**
 * Detect a content input directory: prefers `docs/`, then `doc/`. Returns the
 * directory name relative to `contentDir`, or `''` when neither exists.
 */
export async function detectInputPath(contentDir: string): Promise<string> {
  for (const name of ['docs', 'doc']) {
    try {
      const info = await stat(path.join(contentDir, name))
      if (info.isDirectory()) return name
    } catch {
      // Not present; try next candidate.
    }
  }
  return ''
}

async function readOriginRemoteUrl(contentDir: string): Promise<string | null> {
  let text: string
  try {
    text = await readFile(path.join(contentDir, '.git', 'config'), 'utf8')
  } catch {
    return null
  }

  let inOrigin = false
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (/^\[remote\s+"origin"\]/i.test(line)) {
      inOrigin = true
      continue
    }
    if (/^\[/.test(line)) {
      inOrigin = false
      continue
    }
    if (inOrigin) {
      const match = line.match(/^url\s*=\s*(.+)$/i)
      if (match) return match[1].trim()
    }
  }
  return null
}

function parseGitHubRepoPath(remoteUrl: string): string | null {
  const sshScp = remoteUrl.match(/^git@github\.com:(.+?)(?:\.git)?$/i)
  if (sshScp) return normalizeRepoPath(sshScp[1])

  const sshProto = remoteUrl.match(/^ssh:\/\/git@github\.com\/(.+?)(?:\.git)?$/i)
  if (sshProto) return normalizeRepoPath(sshProto[1])

  const https = remoteUrl.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/i)
  if (https) return normalizeRepoPath(https[1])

  return null
}

function normalizeRepoPath(rawPath: string): string | null {
  const cleaned = rawPath.replace(/\.git$/i, '').replace(/\/+$/, '')
  const segments = cleaned.split('/')
  if (segments.length !== 2 || segments.some((segment) => segment.length === 0)) {
    return null
  }
  return cleaned
}

async function readCurrentBranch(contentDir: string): Promise<string | null> {
  let text: string
  try {
    text = await readFile(path.join(contentDir, '.git', 'HEAD'), 'utf8')
  } catch {
    return null
  }

  const match = text.trim().match(/^ref:\s*refs\/heads\/(.+)$/)
  return match ? match[1].trim() : null
}
