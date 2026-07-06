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
  /**
   * Where the renderer scripts run (`npm run dev` / `generate` / `preview`).
   * In production this is `<configDir>/<paths.build>` (a materialized copy of
   * the bundled renderer). In dev, when the CLI is run from this repo, it is
   * the checked-in `mdsite-nuxt/` submodule.
   */
  rendererDir: string
  /**
   * Environment to pass to renderer scripts. Includes the bridge vars
   * (`NUXT_CONTENT_PATH`, `CONTENT_DIR`, `MDSITE_CONFIG_PATH`) and, in dev
   * mode, `MDSITE_NITRO_OUTPUT_DIR` pointing the build output at
   * `<configDir>/<paths.build>/.output/` instead of inside the submodule.
   */
  rendererEnv: NodeJS.ProcessEnv
  /**
   * Absolute path of the renderer's Nitro build output directory (the
   * directory that contains `public/` after a successful `npm run generate`).
   *
   * - Production: `<configDir>/<paths.build>/.output` (Nitro's default inside
   *   the materialized copy).
   * - Dev: `<configDir>/<paths.build>/.output` (set via `MDSITE_NITRO_OUTPUT_DIR`
   *   so the build lands alongside the rest of the CLI's working state rather
   *   than inside the `mdsite-nuxt/` submodule).
   *
   * `mdsite clean` removes `<configDir>/<paths.build>` entirely, which
   * covers this path in both modes.
   */
  rendererOutputDir: string
}

interface PrepareRendererOptions {
  configDir?: string
  configPath?: string
}

export async function prepareRenderer(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<PreparedRenderer> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = await resolveRendererDir(rendererBaseDir, config, options)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath, rendererBaseDir)
}

export async function prepareConfiguredRenderer(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<PreparedRenderer> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = await resolveConfiguredRendererDir(rendererBaseDir, config)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath, rendererBaseDir)
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

async function prepareRendererEnvironment(contentDir: string, config: MdsiteConfig, rendererDir: string, configPath?: string, buildBaseDir: string = contentDir): Promise<PreparedRenderer> {
  await writeCompatibilityConfigFile(rendererDir, contentDir, config)

  // In dev mode, the renderer IS the checked-in submodule. Redirect Nitro's
  // output to `<buildBaseDir>/<paths.build>/.output` (the project root, where
  // `mdsite.yml` lives) so the build artifact sits alongside the rest of the
  // CLI's working state (covered by `mdsite clean`) instead of inside the
  // submodule source tree. `buildBaseDir` is the project root, NOT the
  // markdown content dir, so `paths.build` resolves at the project root
  // regardless of `paths.input`.
  const isDevRenderer = !isInsideNodeModules(checkedInRendererDir) && path.resolve(rendererDir) === path.resolve(checkedInRendererDir)
  const rendererOutputDir = isDevRenderer
    ? path.resolve(buildBaseDir, config.paths.build, '.output')
    : path.join(rendererDir, '.output')

  if (isDevRenderer) {
    await mkdir(rendererOutputDir, { recursive: true })
  }

  const rendererEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NUXT_CONTENT_PATH: contentDir,
    CONTENT_DIR: contentDir,
    MDSITE_CONFIG_PATH: configPath ?? path.join(buildBaseDir, 'mdsite.yml')
  }

  if (isDevRenderer) {
    rendererEnv.MDSITE_NITRO_OUTPUT_DIR = rendererOutputDir
  }

  await writeEnvFile(rendererDir, rendererEnv)

  return {
    rendererDir,
    rendererEnv,
    rendererOutputDir
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

export async function hasPreviewArtifacts(rendererOutputDir: string): Promise<boolean> {
  const previewArtifacts = [
    path.join(rendererOutputDir, 'public')
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

export async function ensurePreviewArtifacts(rendererOutputDir: string): Promise<void> {
  if (!(await hasPreviewArtifacts(rendererOutputDir))) {
    throw new Error('Preview is unavailable. Run `mdsite generate` before `mdsite static`.')
  }
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

  if (env.MDSITE_NITRO_OUTPUT_DIR) {
    envLines.push(`MDSITE_NITRO_OUTPUT_DIR=${serializeEnvValue(env.MDSITE_NITRO_OUTPUT_DIR)}`)
  }

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
