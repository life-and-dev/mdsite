import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  buildDefaultMdsiteConfig,
  loadMdsiteConfig,
  serializeMdsiteConfig,
  type MdsiteConfig
} from '../config/mdsite-config.js'
import { getBundledRendererDir } from '../renderer/mdsite-nuxt.js'

const NVMRC_VERSION = '24'
const FALLBACK_RENDERER_NAME = 'mdsite-renderer'

function buildNvmrcContent(): string {
  return `${NVMRC_VERSION}\n`
}

/**
 * Derive a valid npm package name from an arbitrary directory name.
 * npm names must be lowercase, URL-safe (a-z 0-9 . _ ~ -), cannot start with
 * `.` or `_`, and must be <= 214 chars. Invalid chars become `-`; runs of `-`
 * collapse; leading `._-` and trailing `-` are trimmed; empty result falls back.
 */
function sanitizeNpmName(rawName: string): string {
  const sanitized = rawName
    .toLowerCase()
    .replace(/[^a-z0-9._~-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+$/, '')
    .slice(0, 214)
    .replace(/^[._]+/, '')
    .replace(/-+$/, '')
  return sanitized.length > 0 ? sanitized : FALLBACK_RENDERER_NAME
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

export async function runInitCommand(contentDir: string): Promise<string> {
  const configPath = path.join(contentDir, 'mdsite.yml')
  const created: string[] = []

  // 1. mdsite.yml — user config; create from defaults only if missing, NEVER overwrite.
  let config: MdsiteConfig
  if (await pathExists(configPath)) {
    const loaded = await loadMdsiteConfig(contentDir)
    config = loaded.config
  } else {
    config = await buildDefaultMdsiteConfig(contentDir)
    await writeFile(configPath, serializeMdsiteConfig(config), 'utf8')
    created.push('mdsite.yml')
  }

  // 2. .nvmrc — user config; create only if missing, NEVER overwrite.
  const nvmrcPath = path.join(contentDir, '.nvmrc')
  if (!(await pathExists(nvmrcPath))) {
    await writeFile(nvmrcPath, buildNvmrcContent(), 'utf8')
    created.push('.nvmrc')
  }

  // 3. Renderer lockfile pair — mdsite-managed; copy each from bundled renderer only if missing.
  const lockfileCreated = await ensureCommittedRendererLockfiles(contentDir, config)
  created.push(...lockfileCreated)

  // 4. .gitignore — managed block is mdsite's own state; always (re)write merged file preserving user lines.
  await ensureContentGitignore(contentDir, config)

  if (created.length === 0) {
    return `All mdsite files already present in ${contentDir}; nothing to create.`
  }
  return `Created ${created.join(', ')} in ${contentDir}.`
}

export async function ensureInitialized(contentDir: string): Promise<boolean> {
  const configPath = path.join(contentDir, 'mdsite.yml')
  if (await pathExists(configPath)) {
    return false
  }

  console.log(`No mdsite.yml found in ${contentDir}. Running \`mdsite init\` automatically...`)
  console.log(await runInitCommand(contentDir))
  return true
}

async function ensureCommittedRendererLockfiles(
  contentDir: string,
  config: MdsiteConfig
): Promise<string[]> {
  const serverDir = path.resolve(contentDir, config.server.path)
  await mkdir(serverDir, { recursive: true })

  const bundledRendererDir = getBundledRendererDir()
  const rendererName = sanitizeNpmName(path.basename(contentDir))
  const created: string[] = []

  const targetPkg = path.join(serverDir, 'package.json')
  if (!(await pathExists(targetPkg))) {
    const bundledPkgRaw = await readFile(path.join(bundledRendererDir, 'package.json'), 'utf8')
    const pkg = JSON.parse(bundledPkgRaw) as Record<string, unknown>
    pkg.name = rendererName
    pkg.description = config.site.name
    await writeFile(targetPkg, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
    created.push(`${config.server.path}/package.json`)
  }

  const targetLock = path.join(serverDir, 'package-lock.json')
  if (!(await pathExists(targetLock))) {
    try {
      const bundledLockRaw = await readFile(path.join(bundledRendererDir, 'package-lock.json'), 'utf8')
      const lock = JSON.parse(bundledLockRaw) as { name?: unknown; packages?: Record<string, unknown> }
      lock.name = rendererName
      if (lock.packages && typeof lock.packages === 'object' && lock.packages['']) {
        ;(lock.packages[''] as { name?: unknown }).name = rendererName
      }
      await writeFile(targetLock, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')
      created.push(`${config.server.path}/package-lock.json`)
    } catch {
      // Bundled renderer has no lockfile; leave the target without one (npm install will generate it).
    }
  }

  return created
}

async function ensureContentGitignore(contentDir: string, config: MdsiteConfig): Promise<void> {
  const serverPath = config.server.path.replace(/\\/g, '/')
  const serverOutput = config.server.output.replace(/\\/g, '/')
  const requiredPatterns = [
    `${serverPath}/*`,
    `!${serverPath}/package.json`,
    `!${serverPath}/package-lock.json`,
    `${serverOutput}/`
  ]
  const managedBlock = [
    '# mdsite: generated state (renderer working dir; lockfile pair committed for reproducible CI)',
    ...requiredPatterns,
    '# end mdsite'
  ]

  const gitignorePath = path.join(contentDir, '.gitignore')
  let existingLines: string[] = []
  try {
    existingLines = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/)
  } catch {
    // No existing .gitignore; start fresh.
  }

  const startIndex = existingLines.indexOf(managedBlock[0])
  const endIndex = existingLines.indexOf(managedBlock[managedBlock.length - 1])

  let preserved: string[]
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    // Complete prior managed block present: replace ONLY the block (markers inclusive).
    // Every line OUTSIDE the block is preserved verbatim — including any user line that
    // coincidentally matches a managed pattern (we no longer strip it from its position).
    preserved = [
      ...existingLines.slice(0, startIndex),
      ...existingLines.slice(endIndex + 1)
    ]
  } else {
    // No complete block (fresh file, orphan/corrupted markers, or pre-marker legacy writes).
    // Remove any line that exactly matches a managed marker/pattern so a fresh block can be
    // emitted without duplicating prior mdsite-written lines; keep all other user lines verbatim.
    const managedMarkers = new Set(managedBlock)
    preserved = existingLines.filter((line) => !managedMarkers.has(line))
  }

  // Drop trailing blank lines to keep the merge idempotent (no separator accumulation on re-runs).
  while (preserved.length > 0 && preserved[preserved.length - 1] === '') {
    preserved.pop()
  }

  const merged: string[] = [...preserved]
  if (merged.length > 0) {
    merged.push('')
  }
  merged.push(...managedBlock)

  await writeFile(gitignorePath, `${merged.join('\n')}\n`, 'utf8')
}
