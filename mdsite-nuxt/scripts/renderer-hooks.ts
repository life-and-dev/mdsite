import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

import { buildContentData } from './generate-indices.js'
import { generateFavicons, copyFaviconsToPublic, generateWebManifest } from './generate-favicons.js'
import { startWatcher, syncContent } from './sync-content.js'
import { loadMdsiteConfigSync, resolveMdsiteConfigPath } from '../utils/mdsite-config.js'

export interface RendererRuntime {
  config: ReturnType<typeof loadMdsiteConfigSync>['config']
  configPath: string
  contentDir: string
  rootDir: string
}

export function prepareRendererRuntime(rootDir: string, options: {
  configPath?: string
  contentPath?: string
} = {}): RendererRuntime {
  let configPath = resolveMdsiteConfigPath({
    configPath: options.configPath,
    contentPath: options.contentPath ?? process.env.NUXT_CONTENT_PATH
  })

  if (!configPath) {
    configPath = ensureLegacyCompatibilityConfig(rootDir)
  }

  if (!configPath) {
    console.error('❌ No _mdsite.yml configuration found. Set MDSITE_CONFIG_PATH or pass a _mdsite.yml path.')
    process.exit(1)
  }

  const { config, contentDir } = loadMdsiteConfigSync({
    configPath,
    contentPath: options.contentPath ?? process.env.NUXT_CONTENT_PATH
  })

  process.env.NUXT_CONTENT_PATH = contentDir
  process.env.CONTENT_DIR = contentDir
  process.env.MDSITE_CONFIG_PATH = configPath

  console.log(`🚀 Preparing site: ${config.site.name}`)
  console.log(`📂 Content path: ${contentDir}`)
  console.log(`📑 Config file: ${configPath}`)

  if (!fs.existsSync(contentDir)) {
    console.error(`❌ Content directory not found: ${contentDir}`)
    process.exit(1)
  }

  return {
    config,
    configPath,
    contentDir,
    rootDir
  }
}

export async function runSetupHooks(mode: 'setup' | 'build' | 'generate' | 'dev', rootDir: string, options: {
  cached?: boolean
  configPath?: string
  contentPath?: string
} = {}): Promise<RendererRuntime> {
  const runtime = prepareRendererRuntime(rootDir, options)

  if (mode === 'dev') {
    if (!options.cached) {
      await fs.promises.rm(path.join(rootDir, '.data'), { recursive: true, force: true })
    }

    process.env.MDSITE_RENDERER_ORCHESTRATED = '1'
    await startWatcher()
    return runtime
  }

  await syncContent()
  console.log(`\n🔨 Generating navigation and search index...`)
  await buildContentData()
  await generateFaviconAssets(runtime.config.site.name)
  process.env.MDSITE_RENDERER_ORCHESTRATED = '1'

  return runtime
}

export async function runBuildFallbackHooks(siteName: string): Promise<void> {
  console.log(`\n🔨 Generating navigation and search index...`)
  await buildContentData()
  await generateFaviconAssets(siteName)
}

async function generateFaviconAssets(siteName: string): Promise<void> {
  console.log(`\n🎨 Generating favicons for build...`)
  const success = await generateFavicons()

  if (success) {
    await copyFaviconsToPublic()
    await generateWebManifest(siteName)
    console.log(`✅ Favicons ready for ${siteName}\n`)
  }
}

function ensureLegacyCompatibilityConfig(rootDir: string): string | undefined {
  const legacyConfigPath = path.join(rootDir, 'content.config.yml')

  if (!fs.existsSync(legacyConfigPath) || !fs.statSync(legacyConfigPath).isFile()) {
    return undefined
  }

  const legacyConfig = YAML.parse(fs.readFileSync(legacyConfigPath, 'utf8')) ?? {}
  const contentDir = path.resolve(rootDir, legacyConfig.content?.path || legacyConfig.content?.git?.path || 'docs')
  const compatibilityConfigPath = path.join(rootDir, '.mdsite-compat.yml')
  const compatibilityConfig = {
    favicon: '',
    features: {
      bibleTooltips: legacyConfig.features?.bibleTooltips ?? true,
      sourceEdit: legacyConfig.features?.sourceEdit ?? true
    },
    menu: [],
    server: {
      output: '.output',
      path: '.mdsite',
      repo: legacyConfig.content?.git?.repo || ''
    },
    site: {
      canonical: legacyConfig.site?.canonical || '',
      name: legacyConfig.site?.name || path.basename(contentDir) || 'Site'
    },
    themes: legacyConfig.themes || {}
  }

  fs.writeFileSync(compatibilityConfigPath, YAML.stringify(compatibilityConfig), 'utf8')
  process.env.NUXT_CONTENT_PATH = contentDir
  process.env.CONTENT_DIR = contentDir
  process.env.MDSITE_CONFIG_PATH = compatibilityConfigPath

  console.warn(`⚠️ Using legacy compatibility fallback from ${legacyConfigPath}`)

  return compatibilityConfigPath
}
