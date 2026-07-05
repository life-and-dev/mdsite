import { access, cp, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import YAML from 'yaml'

import type { MdsiteConfig } from '../config/mdsite-config.js'
import { runForeground, runBackground } from '../process/child-process.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const checkedInRendererDir = path.join(repoRoot, 'mdsite-nuxt')
const rendererCopyIgnoredNames = new Set(['node_modules', '.nuxt', '.output', 'dist', '.cache'])

export function getBundledRendererDir(): string {
  return checkedInRendererDir
}

export function isInsideNodeModules(targetDir: string): boolean {
  return targetDir.split(path.sep).includes('node_modules')
}

interface PreparedRenderer {
  rendererDir: string
  rendererEnv: NodeJS.ProcessEnv
}

interface PrepareRendererOptions {
  configDir?: string
  configPath?: string
}

export async function prepareRenderer(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<PreparedRenderer> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = await resolveRendererDir(rendererBaseDir, config, options)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath)
}

export async function prepareConfiguredRenderer(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<PreparedRenderer> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = await resolveConfiguredRendererDir(rendererBaseDir, config)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath)
}

export async function ensureConfiguredRendererInstalled(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<string> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = path.resolve(rendererBaseDir, config.paths.build)

  await ensureDirectoryIsAvailable(rendererDir)

  if (rendererDir !== checkedInRendererDir) {
    await cp(checkedInRendererDir, rendererDir, {
      recursive: true,
      force: true,
      filter: shouldCopyRendererPath
    })
  }

  return rendererDir
}

async function prepareRendererEnvironment(contentDir: string, config: MdsiteConfig, rendererDir: string, configPath?: string): Promise<PreparedRenderer> {
  await writeCompatibilityConfigFile(rendererDir, contentDir, config)

  const rendererEnv = {
    ...process.env,
    NUXT_CONTENT_PATH: contentDir,
    CONTENT_DIR: contentDir,
    MDSITE_CONFIG_PATH: configPath ?? path.join(contentDir, 'mdsite.yml')
  }

  await writeEnvFile(rendererDir, rendererEnv)

  return {
    rendererDir,
    rendererEnv
  }
}

export async function ensureRendererDependencies(rendererDir: string): Promise<void> {
  try {
    await access(path.join(rendererDir, 'node_modules'))
  } catch {
    const hasLockfile = await pathExists(path.join(rendererDir, 'package-lock.json'))
    const installCommand = hasLockfile ? 'ci' : 'install'
    await runForeground('npm', [installCommand], rendererDir, process.env)
  }
}

export async function startRendererInBackground(rendererDir: string, env: NodeJS.ProcessEnv, logPath: string): Promise<number> {
  return runRendererScriptInBackground(rendererDir, env, 'dev', logPath)
}

export async function startRendererForeground(rendererDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  await runRendererScript(rendererDir, env, 'dev')
}

export async function previewRendererInBackground(rendererDir: string, env: NodeJS.ProcessEnv, logPath: string): Promise<number> {
  return runRendererScriptInBackground(rendererDir, env, 'preview', logPath)
}

export async function previewRendererForeground(rendererDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  await runRendererScript(rendererDir, env, 'preview')
}

export async function generateRenderer(rendererDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  await runRendererScript(rendererDir, env, 'generate')
}

export async function prepareRendererBackend(rendererDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  await runRendererScript(rendererDir, env, 'prepare:renderer')
}

export async function hasPreviewArtifacts(rendererDir: string): Promise<boolean> {
  const previewArtifacts = [
    path.join(rendererDir, '.output', 'public')
  ]

  for (const artifactPath of previewArtifacts) {
    try {
      await access(artifactPath)
    } catch {
      return false
    }
  }

  return true
}

export async function ensurePreviewArtifacts(rendererDir: string): Promise<void> {
  if (!(await hasPreviewArtifacts(rendererDir))) {
    throw new Error('Preview is unavailable. Run `mdsite generate` before `mdsite static`.')
  }
}

export function getRendererGeneratedOutputPath(rendererDir: string): string {
  return path.join(rendererDir, '.output', 'public')
}

/**
 * Path of the renderer's own generated output directory for the current install,
 * for use by `mdsite clean`.
 *
 * - Production (CLI installed via npm): the renderer is materialized into
 *   `<configDir>/<paths.build>`, so this returns `undefined` — the existing
 *   `paths.build` removal already covers `<paths.build>/.output`.
 * - Dev (CLI run from this repo): the renderer is the checked-in `mdsite-nuxt/`
 *   submodule, so this returns `<mdsite-nuxt>/.output` for `mdsite clean` to
 *   wipe stale Nuxt build artifacts that would otherwise survive the clean
 *   and make `mdsite static` serve the previous config.
 * - Submodule missing (e.g. shallow clone): returns `undefined` — nothing to
 *   clean beyond `paths.build`/`paths.output`.
 */
export async function resolveRendererOutputPath(configDir: string, config: MdsiteConfig): Promise<string | undefined> {
  const buildDir = path.resolve(configDir, config.paths.build)

  if (isInsideNodeModules(checkedInRendererDir)) {
    return undefined
  }

  if (!await pathExists(checkedInRendererDir)) {
    return undefined
  }

  if (path.resolve(checkedInRendererDir) === buildDir) {
    return undefined
  }

  return path.join(checkedInRendererDir, '.output')
}

async function resolveRendererDir(rendererBaseDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<string> {
  if (isInsideNodeModules(checkedInRendererDir)) {
    return ensureConfiguredRendererInstalled(rendererBaseDir, config, options)
  }

  if (!await pathExists(checkedInRendererDir)) {
    throw new Error(`Renderer directory not found at ${checkedInRendererDir}. Expected checked-in mdsite-nuxt renderer.`)
  }

  return checkedInRendererDir
}

async function resolveConfiguredRendererDir(contentDir: string, config: MdsiteConfig): Promise<string> {
  const rendererDir = path.resolve(contentDir, config.paths.build)

  let rendererStats: Awaited<ReturnType<typeof stat>>
  try {
    rendererStats = await stat(rendererDir)
  } catch {
    throw new Error(`Configured renderer directory not found at ${rendererDir}.`)
  }

  if (!rendererStats.isDirectory()) {
    throw new Error(`Configured renderer path is not a directory: ${rendererDir}`)
  }

  return rendererDir
}

async function ensureDirectoryIsAvailable(directoryPath: string): Promise<void> {
  let directoryStats: Awaited<ReturnType<typeof stat>>

  try {
    directoryStats = await stat(directoryPath)
  } catch {
    await mkdir(directoryPath, { recursive: true })
    return
  }

  if (!directoryStats.isDirectory()) {
    throw new Error(`Configured renderer path is not a directory: ${directoryPath}`)
  }
}

function shouldCopyRendererPath(sourcePath: string): boolean {
  const baseName = path.basename(sourcePath)
  return !rendererCopyIgnoredNames.has(baseName)
}

async function writeEnvFile(rendererDir: string, env: NodeJS.ProcessEnv): Promise<void> {
  const envLines = [
    `NUXT_CONTENT_PATH=${serializeEnvValue(env.NUXT_CONTENT_PATH)}`,
    `CONTENT_DIR=${serializeEnvValue(env.CONTENT_DIR)}`,
    `MDSITE_CONFIG_PATH=${serializeEnvValue(env.MDSITE_CONFIG_PATH)}`
  ]

  await writeFile(path.join(rendererDir, '.env'), `${envLines.join('\n')}\n`, 'utf8')
}

async function writeCompatibilityConfigFile(rendererDir: string, contentDir: string, config: MdsiteConfig): Promise<void> {
  const compatibilityConfig = {
    siteName: config.site.name,
    siteCanonical: config.site.canonical,
    contentPath: contentDir,
    features: {
      'bible-tooltips': config.features.bibleTooltips,
      'source-edit': config.features.sourceEdit
    },
    themes: config.themes
  }

  await writeFile(path.join(rendererDir, 'content.config.yml'), YAML.stringify(compatibilityConfig), 'utf8')
}

async function runRendererScript(rendererDir: string, env: NodeJS.ProcessEnv, scriptName: string): Promise<void> {
  await runForeground('npm', ['run', scriptName], rendererDir, env)
}

async function runRendererScriptInBackground(rendererDir: string, env: NodeJS.ProcessEnv, scriptName: string, logPath: string): Promise<number> {
  return runBackground('npm', ['run', scriptName], rendererDir, env, logPath)
}

function serializeEnvValue(value: string | undefined): string {
  return JSON.stringify(value ?? '')
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}
