import { access, copyFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import YAML from 'yaml'

import type { MdsiteConfig } from '../config/mdsite-config.js'
import { generateMenuFromMarkdownFiles } from '../config/menu.js'
import { runForeground, runBackground } from '../process/child-process.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const checkedInRendererDir = path.join(repoRoot, 'mdsite-nuxt')

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
  const rendererDir = await resolveRendererDir(rendererBaseDir, config)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath)
}

export async function prepareConfiguredRenderer(contentDir: string, config: MdsiteConfig, options: PrepareRendererOptions = {}): Promise<PreparedRenderer> {
  const rendererBaseDir = options.configDir ?? contentDir
  const rendererDir = await resolveConfiguredRendererDir(rendererBaseDir, config)

  return prepareRendererEnvironment(contentDir, config, rendererDir, options.configPath)
}

async function prepareRendererEnvironment(contentDir: string, config: MdsiteConfig, rendererDir: string, configPath?: string): Promise<PreparedRenderer> {
  await ensureMenuFile(contentDir, config)
  await ensureRendererFaviconAlias(contentDir, config)
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

export async function ensurePreviewArtifacts(rendererDir: string): Promise<void> {
  const previewArtifacts = [
    path.join(rendererDir, '.output', 'public')
  ]

  for (const artifactPath of previewArtifacts) {
    try {
      await access(artifactPath)
    } catch {
      throw new Error('Preview is unavailable. Run `mdsite generate` before `mdsite preview`.')
    }
  }
}

export function getRendererGeneratedOutputPath(rendererDir: string): string {
  return path.join(rendererDir, '.output', 'public')
}

async function resolveRendererDir(contentDir: string, config: MdsiteConfig): Promise<string> {
  const configuredRendererDir = path.resolve(contentDir, config.server.path)

  // Phase 1 uses the checked-in renderer when a configured renderer checkout is not present yet.
  const rendererDir = await pathExists(configuredRendererDir) ? configuredRendererDir : checkedInRendererDir

  if (!await pathExists(rendererDir)) {
    throw new Error(`Renderer directory not found at ${rendererDir}. Expected checked-in mdsite-nuxt renderer.`)
  }

  return rendererDir
}

async function resolveConfiguredRendererDir(contentDir: string, config: MdsiteConfig): Promise<string> {
  const rendererDir = path.resolve(contentDir, config.server.path)

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

async function ensureMenuFile(contentDir: string, config: MdsiteConfig): Promise<void> {
  const menu = config.menu.length > 0 ? config.menu : await generateMenuFromMarkdownFiles(contentDir)
  await writeFile(path.join(contentDir, '_menu.yml'), YAML.stringify(menu), 'utf8')
}

async function ensureRendererFaviconAlias(contentDir: string, config: MdsiteConfig): Promise<void> {
  if (!config.favicon.trim()) {
    return
  }

  const sourcePath = path.resolve(contentDir, config.favicon)
  if (!await pathExists(sourcePath)) {
    throw new Error(`Configured favicon file not found: ${sourcePath}`)
  }

  const targetPath = path.join(contentDir, 'logo.svg')

  if (sourcePath === targetPath) {
    return
  }

  await rm(targetPath, { force: true })

  try {
    const relativeTarget = path.relative(contentDir, sourcePath)
    await symlink(relativeTarget, targetPath)
  } catch {
    await copyFile(sourcePath, targetPath)
  }
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
    contentGitRepo: config.server.repo,
    features: config.features,
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
