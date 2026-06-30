import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { buildDefaultMdsiteConfig, serializeMdsiteConfig, type MdsiteConfig } from '../config/mdsite-config.js'
import { getBundledRendererDir } from '../renderer/mdsite-nuxt.js'

const NVMRC_VERSION = '24'

function buildNvmrcContent(): string {
  return `${NVMRC_VERSION}\n`
}

export async function runInitCommand(contentDir: string): Promise<string> {
  const configPath = path.join(contentDir, 'mdsite.yml')

  try {
    await access(configPath)
  } catch {
    const config = await buildDefaultMdsiteConfig(contentDir)
    await writeFile(configPath, serializeMdsiteConfig(config), 'utf8')

    await ensureCommittedRendererLockfiles(contentDir, config)
    await ensureContentGitignore(contentDir, config)

    try {
      await access(path.join(contentDir, '.nvmrc'))
      return `Created mdsite.yml in ${contentDir} (.nvmrc was already present)`
    } catch {
      await writeFile(path.join(contentDir, '.nvmrc'), buildNvmrcContent(), 'utf8')
      return `Created mdsite.yml and .nvmrc in ${contentDir}`
    }
  }

  throw new Error(`mdsite.yml already exists at ${configPath}.`)
}

async function ensureCommittedRendererLockfiles(contentDir: string, config: MdsiteConfig): Promise<void> {
  const serverDir = path.resolve(contentDir, config.server.path)
  await mkdir(serverDir, { recursive: true })

  const bundledRendererDir = getBundledRendererDir()
  await copyFile(path.join(bundledRendererDir, 'package.json'), path.join(serverDir, 'package.json'))

  try {
    await copyFile(path.join(bundledRendererDir, 'package-lock.json'), path.join(serverDir, 'package-lock.json'))
  } catch {
    // Bundled renderer has no lockfile; leave the target without one (npm install will generate it).
  }
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
  const managedMarkers = new Set(managedBlock)

  const gitignorePath = path.join(contentDir, '.gitignore')
  let existingLines: string[] = []
  try {
    existingLines = (await readFile(gitignorePath, 'utf8')).split(/\r?\n/)
  } catch {
    // No existing .gitignore; start fresh.
  }

  // Preserve user-authored lines verbatim; drop any prior managed-block lines so we can re-emit a clean block.
  const userLines = existingLines.filter((line) => !managedMarkers.has(line))
  // Drop trailing blank lines to keep the merge idempotent (no separator accumulation on re-runs).
  while (userLines.length > 0 && userLines[userLines.length - 1] === '') {
    userLines.pop()
  }

  const merged: string[] = [...userLines]
  if (merged.length > 0) {
    merged.push('')
  }
  merged.push(...managedBlock)

  await writeFile(gitignorePath, `${merged.join('\n')}\n`, 'utf8')
}
