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

// svg is preferred (vector, tiny), then raster formats by quality/size, with
// .ico kept as a legacy last resort within each naming pattern.
const faviconExtensions = ['svg', 'png', 'webp', 'jpg', 'ico']

/**
 * Build the ordered list of favicon filename candidates. Priority (highest to
 * lowest), with `<ext>` iterating `svg` > `png` > `webp` > `jpg` > `ico`:
 *   1. `favicon.<ext>`
 *   2. `<cwdName>-logo.<ext>`
 *   3. `<cwdName>.<ext>`
 *   4. `logo.<ext>`
 */
function buildFaviconCandidates(cwdName: string): string[] {
  const basenames = ['favicon', `${cwdName}-logo`, cwdName, 'logo']
  const candidates: string[] = []
  for (const base of basenames) {
    for (const ext of faviconExtensions) {
      candidates.push(`${base}.${ext}`)
    }
  }
  return candidates
}

/**
 * Read a directory into a map of lowercased filename -> actual filename for
 * files, and a sorted list of immediate subdirectory names (skipping entries
 * in `ignoredDirectories` and names starting with `.`). Returns `null` when
 * the directory cannot be read.
 */
async function listFaviconDir(dir: string): Promise<{
  files: Map<string, string>
  subdirs: string[]
} | null> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }
  const files = new Map<string, string>()
  const subdirs: string[] = []
  for (const entry of entries) {
    if (entry.isFile()) {
      files.set(entry.name.toLowerCase(), entry.name)
    } else if (entry.isDirectory() && !ignoredDirectories.has(entry.name) && !entry.name.startsWith('.')) {
      subdirs.push(entry.name)
    }
  }
  subdirs.sort((left, right) => left.localeCompare(right))
  return { files, subdirs }
}

/**
 * Scan `contentRoot` and its immediate subdirectories for the first favicon
 * candidate in priority order. Candidates are tried as:
 *   1. `favicon.<ext>`
 *   2. `<cwdName>-logo.<ext>`
 *   3. `<cwdName>.<ext>`
 *   4. `logo.<ext>`
 * where `<ext>` iterates `svg` > `png` > `webp` > `jpg` > `ico`, and
 * `<cwdName>` defaults to the basename of `process.cwd()`. For each
 * candidate the top level of `contentRoot` is checked first, then its
 * immediate subdirectories (alphabetical), so pattern/format priority
 * dominates over depth. Matching is case-insensitive but the returned
 * filename preserves its original case. Returns the match path relative to
 * `contentRoot` with forward slashes, or `''` when nothing matches. When
 * `''` is returned the renderer falls back to generating a monogram icon.
 */
export async function detectFavicon(
  contentRoot: string,
  cwdName: string = path.basename(process.cwd())
): Promise<string> {
  const candidates = buildFaviconCandidates(cwdName)

  const top = await listFaviconDir(contentRoot)
  const topLevelFiles = top?.files ?? new Map<string, string>()
  const subdirNames = top?.subdirs ?? []
  const subdirCache = new Map<string, Map<string, string>>()

  for (const candidate of candidates) {
    const topMatch = topLevelFiles.get(candidate.toLowerCase())
    if (topMatch) {
      return topMatch
    }

    for (const subdir of subdirNames) {
      let files = subdirCache.get(subdir)
      if (!files) {
        const sub = await listFaviconDir(path.join(contentRoot, subdir))
        files = sub?.files ?? new Map<string, string>()
        subdirCache.set(subdir, files)
      }
      const match = files.get(candidate.toLowerCase())
      if (match) {
        return path.join(subdir, match).split(path.sep).join('/')
      }
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

    // User/org GitHub Pages repos are named <owner>.github.io and served at
    // the bare domain; project pages live under <owner>.github.io/<repo>.
    if (repo.endsWith('.github.io')) {
      return `https://${repo}`
    }
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
  // Root-level only: nested doc/docs dirs are intentionally ignored.
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
