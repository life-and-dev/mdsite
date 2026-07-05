import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  buildDefaultMdsiteConfig,
  loadMdsiteConfig,
  serializeMdsiteConfig,
  type MdsiteConfig
} from '../config/mdsite-config.js'

const NVMRC_VERSION = '24'

function buildNvmrcContent(): string {
  return `${NVMRC_VERSION}\n`
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

  // 3. .gitignore — managed block is mdsite's own state; always (re)write merged file preserving user lines.
  await ensureContentGitignore(contentDir, config)

  if (created.length === 0) {
    return `All mdsite files already present in ${contentDir}; nothing to create.`
  }
  return `Created ${created.join(', ')} in ${contentDir}.`
}

export async function ensureInitialized(contentDir: string): Promise<boolean> {
  // Ensure every init-managed file is present, not just mdsite.yml. A project
  // with an existing mdsite.yml but a missing .nvmrc (e.g. created before
  // .nvmrc support landed, or hand-authored) otherwise never gets repaired by
  // live/generate/static, leaving hosts without a Node version pin.
  const managedFiles = ['mdsite.yml', '.nvmrc', '.gitignore']
  const missing: string[] = []
  for (const file of managedFiles) {
    if (!(await pathExists(path.join(contentDir, file)))) {
      missing.push(file)
    }
  }
  if (missing.length === 0) {
    return false
  }

  console.log(`Missing ${missing.join(', ')} in ${contentDir}. Running \`mdsite init\` automatically...`)
  console.log(await runInitCommand(contentDir))
  return true
}

async function ensureContentGitignore(contentDir: string, config: MdsiteConfig): Promise<void> {
  const serverPath = config.paths.build.replace(/\\/g, '/')
  const serverOutput = config.paths.output.replace(/\\/g, '/')
  const requiredPatterns = [
    `${serverPath}/*`,
    `${serverOutput}/`
  ]
  const managedBlock = [
    '# mdsite: generated state (renderer working dir; runtime artifacts and materialized renderer)',
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
