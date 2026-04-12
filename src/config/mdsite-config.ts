import { readFile } from 'node:fs/promises'
import path from 'node:path'

import YAML from 'yaml'

import { createDefaultMdsiteConfig } from './default-mdsite-config.js'
import { deriveSiteNameFromIndex, generateMenuFromMarkdownFiles } from './menu.js'

export type MenuItem = string | null | { [key: string]: string | null | MenuItem[] }

export interface MdsiteConfig {
  favicon: string
  features: {
    bibleTooltips: boolean
    sourceEdit: boolean
  }
  menu: MenuItem[]
  server: {
    output: string
    path: string
    repo: string
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
  configPath: string
  contentDir: string
}

const configFileName = '_mdsite.yml'

export async function loadMdsiteConfig(contentDir: string): Promise<LoadedMdsiteConfig> {
  const configPath = path.join(contentDir, configFileName)

  let rawText: string
  try {
    rawText = await readFile(configPath, 'utf8')
  } catch {
    throw new Error(`Missing ${configFileName} in ${contentDir}. Run \`mdsite init\` first.`)
  }

  const parsed = YAML.parse(rawText) ?? {}

  return {
    config: await normalizeMdsiteConfig(parsed, contentDir),
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

  return {
    favicon: typeof rawConfig.favicon === 'string' ? rawConfig.favicon : fallbackConfig.favicon,
    features: {
      bibleTooltips: rawConfig.features?.bibleTooltips ?? fallbackConfig.features.bibleTooltips,
      sourceEdit: rawConfig.features?.sourceEdit ?? fallbackConfig.features.sourceEdit
    },
    menu: Array.isArray(rawConfig.menu) ? rawConfig.menu : fallbackConfig.menu,
    server: {
      output: typeof rawConfig.server?.output === 'string' ? rawConfig.server.output : fallbackConfig.server.output,
      path: typeof rawConfig.server?.path === 'string' ? rawConfig.server.path : fallbackConfig.server.path,
      repo: typeof rawConfig.server?.repo === 'string' ? rawConfig.server.repo : fallbackConfig.server.repo
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
  return path.resolve(contentDir, config.server.output)
}
