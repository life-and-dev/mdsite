import { readFile } from 'node:fs/promises'
import path from 'node:path'

import YAML from 'yaml'

import { createDefaultMdsiteConfig } from './default-mdsite-config.js'
import { detectFavicon, detectInputPath, detectSourceEditUrl } from './detect.js'
import { deriveSiteName, generateMenuFromMarkdownFiles } from './menu.js'

export type MenuItem = string | null | { [key: string]: string | null | MenuItem[] }

/**
 * Footer items mirror the `menu` shape but with no nested sub-menus. Each item
 * is one of:
 *   - a bare markdown file name (string) — title is read from the file's H1
 *   - `null` — rendered as a vertical separator
 *   - a single-key object — the key is the link text, the value is either an
 *     internal markdown path or an external URL (http/https)
 *
 * Lives under `features.footer` in `mdsite.yml`.
 */
export type FooterItem = string | null | { [key: string]: string | null }

/**
 * Runtime type-guard for entries inside the `footer:` YAML list. Accepts:
 *   - non-empty strings (file names / external URLs)
 *   - `null` (separator)
 *   - single-key objects whose value is a string or `null`
 * Drops anything else silently to stay backwards-compatible with malformed
 * user input; the renderer mirrors this filter.
 */
function isValidFooterItem(item: unknown): item is FooterItem {
  if (item === null) return true
  if (typeof item === 'string') return item.trim().length > 0
  if (typeof item === 'object') {
    const keys = Object.keys(item as Record<string, unknown>)
    if (keys.length !== 1) return false
    const value = (item as Record<string, unknown>)[keys[0]]
    return value === null || typeof value === 'string'
  }
  return false
}

export interface MdsiteConfig {
  features: {
    bibleTooltips: boolean
    /**
     * URL prefix for the "Edit on GitHub" link. The renderer appends
     * `<route>.md` to this value to build the edit URL, so the prefix should
     * end with `/` (e.g. `https://github.com/org/repo/blob/main/`). An
     * empty string disables the edit button entirely.
     */
    sourceEdit: string
    /**
     * Footer items mirror the `menu` shape but with no nested sub-menus.
     * Each item is one of:
     *   - a bare markdown file name (string) — title is read from the file's H1
     *   - `null` — rendered as a vertical separator
     *   - a single-key object — the key is the link text, the value is either
     *     an internal markdown path or an external URL (http/https)
     */
    footer: FooterItem[]
  }
  menu: MenuItem[]
  paths: {
    input: string
    build: string
    output: string
  }
  site: {
    canonical: string
    favicon: string
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

/**
 * Recursive variant of `Partial<T>` for object shapes. Recurses into nested
 * objects so callers can override a single leaf field without restating the
 * rest of the tree. Arrays are passed through unchanged — they should be
 * replaced wholesale, not partially merged — and primitives pass through too.
 *
 * Use this for test/build helpers that layer overrides over a full default
 * object — `Partial<MdsiteConfig>` is too shallow because it only makes the
 * top-level keys optional.
 */
export type DeepPartial<T> = T extends ReadonlyArray<unknown>
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

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
  const siteName = await deriveSiteName(contentDir)
  const menu = await generateMenuFromMarkdownFiles(contentDir)
  const favicon = await detectFavicon(contentDir)
  const sourceEdit = await detectSourceEditUrl(contentDir)
  const inputPath = await detectInputPath(contentDir)
  return createDefaultMdsiteConfig(siteName, menu, { favicon, sourceEdit, inputPath })
}

export function serializeMdsiteConfig(config: MdsiteConfig): string {
  return YAML.stringify(config)
}

async function normalizeMdsiteConfig(rawConfig: Record<string, any>, contentDir: string): Promise<MdsiteConfig> {
  const fallbackConfig = await buildDefaultMdsiteConfig(contentDir)
  const inputPath = resolveInputConfigPath(rawConfig.paths?.input)

  return {
    features: {
      bibleTooltips: rawConfig.features?.['bible-tooltips'] ?? fallbackConfig.features.bibleTooltips,
      sourceEdit: typeof rawConfig.features?.['source-edit'] === 'string'
        ? rawConfig.features['source-edit']
        : fallbackConfig.features.sourceEdit,
      footer: Array.isArray(rawConfig.features?.footer)
        ? rawConfig.features.footer.filter(isValidFooterItem)
        : fallbackConfig.features.footer
    },
    menu: Array.isArray(rawConfig.menu) ? rawConfig.menu : fallbackConfig.menu,
    paths: {
      input: inputPath ?? fallbackConfig.paths.input,
      build: typeof rawConfig.paths?.build === 'string' ? rawConfig.paths.build : fallbackConfig.paths.build,
      output: typeof rawConfig.paths?.output === 'string' ? rawConfig.paths.output : fallbackConfig.paths.output
    },
    site: {
      canonical: typeof rawConfig.site?.canonical === 'string' ? rawConfig.site.canonical : fallbackConfig.site.canonical,
      favicon: typeof rawConfig.site?.favicon === 'string' ? rawConfig.site.favicon : fallbackConfig.site.favicon,
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
  return path.resolve(contentDir, config.paths.output, 'public')
}

/**
 * Extract the content path from `paths.input`. Accepts either a shorthand
 * string form (`paths: { input: docs }`) or a nested object form. Returns
 * undefined when no usable path is configured.
 */
function resolveInputConfigPath(rawInput: unknown): string | undefined {
  if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (rawInput && typeof rawInput === 'object' && typeof (rawInput as { path?: unknown }).path === 'string') {
    return (rawInput as { path: string }).path
  }

  return undefined
}

export function resolveConfiguredContentDir(configDir: string, rawConfig: Record<string, any>): string {
  const inputPath = resolveInputConfigPath(rawConfig.paths?.input)
  return inputPath ? path.resolve(configDir, inputPath) : configDir
}
