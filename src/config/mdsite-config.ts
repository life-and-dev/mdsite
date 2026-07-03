import { readFile } from 'node:fs/promises'
import path from 'node:path'

import YAML from 'yaml'

import { createDefaultMdsiteConfig } from './default-mdsite-config.js'
import { deriveSiteNameFromIndex, generateMenuFromMarkdownFiles } from './menu.js'

export type MenuItem = string | null | { [key: string]: string | null | MenuItem[] }

export interface MdsiteConfig {
  content?: {
    path?: string
  }
  favicon: string
  features: {
    bibleTooltips: boolean
    sourceEdit: boolean
  }
  menu: MenuItem[]
  footer: string[]
  server: {
    output: string
    path: string
    repo: string
    gitBranch: string
  }
  site: {
    canonical: string
    name: string
  }
  themes: {
    light: {
      colors: Record<string, string>
    }
    dark: {
      colors: Record<string, string>
    }
  }
}

export interface LoadedMdsiteConfig {
  config: MdsiteConfig
  configDir: string
  configPath: string
  contentDir: string
}

const configFileName = 'mdsite.yml'

export async function loadMdsiteConfig(configDir: string): Promise<LoadedMdsiteConfig> {
  const configPath = path.join(configDir, configFileName)

  let rawText: string
  try {
    rawText = await readFile(configPath, 'utf8')
  } catch {
    throw new Error(`Missing ${configFileName} in ${configDir}. Run \`mdsite init\` first.`)
  }

  const parsed = YAML.parse(rawText) ?? {}
  const contentDir = resolveConfiguredContentDir(configDir, parsed)

  return {
    config: await normalizeMdsiteConfig(parsed, contentDir),
    configDir,
    configPath,
    contentDir
  }
}

export async function buildDefaultMdsiteConfig(contentDir: string): Promise<MdsiteConfig> {
  const siteName = await deriveSiteNameFromIndex(contentDir)
  const menu = await generateMenuFromMarkdownFiles(contentDir)
  return createDefaultMdsiteConfig(siteName, menu)
}

export function serializeMdsiteConfig(config: MdsiteConfig): string {
  return YAML.stringify(config)
}

async function normalizeMdsiteConfig(rawConfig: Record<string, any>, contentDir: string): Promise<MdsiteConfig> {
  const fallbackConfig = await buildDefaultMdsiteConfig(contentDir)
  const contentPath = resolveContentConfigPath(rawConfig.content)

  return {
    favicon: typeof rawConfig.favicon === 'string' ? rawConfig.favicon : fallbackConfig.favicon,
    features: {
      bibleTooltips: rawConfig.features?.bibleTooltips ?? fallbackConfig.features.bibleTooltips,
      sourceEdit: rawConfig.features?.sourceEdit ?? fallbackConfig.features.sourceEdit
    },
    content: contentPath ? { path: contentPath } : fallbackConfig.content,
    menu: Array.isArray(rawConfig.menu) ? rawConfig.menu : fallbackConfig.menu,
    footer: Array.isArray(rawConfig.footer) ? rawConfig.footer.filter((item): item is string => typeof item === 'string') : [],
    server: {
      output: typeof rawConfig.server?.output === 'string' ? rawConfig.server.output : fallbackConfig.server.output,
      path: typeof rawConfig.server?.path === 'string' ? rawConfig.server.path : fallbackConfig.server.path,
      repo: typeof rawConfig.server?.repo === 'string' ? rawConfig.server.repo : fallbackConfig.server.repo,
      gitBranch: typeof rawConfig.server?.['git-branch'] === 'string' && rawConfig.server['git-branch'].trim()
        ? rawConfig.server['git-branch']
        : fallbackConfig.server.gitBranch
    },
    site: {
      canonical: typeof rawConfig.site?.canonical === 'string' ? rawConfig.site.canonical : fallbackConfig.site.canonical,
      name: typeof rawConfig.site?.name === 'string' && rawConfig.site.name.trim() ? rawConfig.site.name : fallbackConfig.site.name
    },
    themes: {
      light: {
        colors: {
          ...fallbackConfig.themes.light.colors,
          ...(rawConfig.themes?.light?.colors ?? {})
        }
      },
      dark: {
        colors: {
          ...fallbackConfig.themes.dark.colors,
          ...(rawConfig.themes?.dark?.colors ?? {})
        }
      }
    }
  }
}

export function resolveContentOutputPath(contentDir: string, config: MdsiteConfig): string {
  return path.resolve(contentDir, config.server.output, 'public')
}

/**
 * Extract the content path from either the shorthand string form
 * (`content: docs`) or the explicit object form (`content:\n  path: docs`).
 * Returns undefined when no usable path is configured.
 */
function resolveContentConfigPath(rawContent: unknown): string | undefined {
  if (typeof rawContent === 'string') {
    const trimmed = rawContent.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (rawContent && typeof rawContent === 'object' && typeof (rawContent as { path?: unknown }).path === 'string') {
    return (rawContent as { path: string }).path
  }

  return undefined
}

export function resolveConfiguredContentDir(configDir: string, rawConfig: Record<string, any>): string {
  const contentPath = resolveContentConfigPath(rawConfig.content)
  return contentPath ? path.resolve(configDir, contentPath) : configDir
}
