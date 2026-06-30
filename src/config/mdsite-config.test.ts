import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import {
  buildDefaultMdsiteConfig,
  loadMdsiteConfig,
  resolveContentOutputPath,
  serializeMdsiteConfig
} from './mdsite-config.js'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'mdsite-config-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('mdsite config helpers', () => {
  it('buildDefaultMdsiteConfig derives the site name and menu from markdown files', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# My Docs', 'utf8')
    await writeFile(path.join(contentDir, 'guide.md'), '# Guide', 'utf8')

    const config = await buildDefaultMdsiteConfig(contentDir)

    expect(config.site.name).toBe('My Docs')
    expect(config.menu).toEqual(['guide'])
    expect(config.server.output).toBe('.output')
  })

  it('serializeMdsiteConfig returns yaml text with the configured values', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Docs', 'utf8')

    const config = await buildDefaultMdsiteConfig(contentDir)
    const yamlText = serializeMdsiteConfig(config)

    expect(yamlText).toContain('name: Docs')
    expect(yamlText).toContain('output: .output')
  })

  it('loadMdsiteConfig errors when mdsite.yml is missing', async () => {
    const contentDir = await makeTempDir()

    await expect(loadMdsiteConfig(contentDir)).rejects.toThrow(
      `Missing mdsite.yml in ${contentDir}. Run \`mdsite init\` first.`
    )
  })

  it('loadMdsiteConfig merges defaults, preserves explicit false values, and normalizes blank fields', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Derived Name', 'utf8')
    await writeFile(path.join(contentDir, 'guide.md'), '# Guide', 'utf8')
    await writeFile(path.join(contentDir, 'mdsite.yml'), [
      'favicon: assets/favicon.svg',
      'features:',
      '  bibleTooltips: false',
      'menu:',
      '  - custom/page',
      'server:',
      '  output: dist/public',
      '  path: .renderer',
      'site:',
      '  canonical: https://example.test',
      '  name: "   "',
      'themes:',
      '  light:',
      '    colors:',
      '      primary: "#123456"',
      '  dark:',
      '    colors:',
      '      outline: "#abcdef"',
      ''
    ].join('\n'), 'utf8')

    const loaded = await loadMdsiteConfig(contentDir)

    expect(loaded.configPath).toBe(path.join(contentDir, 'mdsite.yml'))
    expect(loaded.contentDir).toBe(contentDir)
    expect(loaded.config.favicon).toBe('assets/favicon.svg')
    expect(loaded.config.features).toEqual({
      bibleTooltips: false,
      sourceEdit: true
    })
    expect(loaded.config.menu).toEqual(['custom/page'])
    expect(loaded.config.server).toEqual({
      output: 'dist/public',
      path: '.renderer',
      repo: 'https://github.com/life-and-dev/mdsite'
    })
    expect(loaded.config.site).toEqual({
      canonical: 'https://example.test',
      name: 'Derived Name'
    })
    expect(loaded.config.themes.light.colors.primary).toBe('#123456')
    expect(loaded.config.themes.light.colors.background).toBe('#f6f8fa')
    expect(loaded.config.themes.dark.colors.outline).toBe('#abcdef')
    expect(loaded.config.themes.dark.colors.primary).toBe('#58a6ff')
  })

  it('loadMdsiteConfig resolves content.path relative to the config directory', async () => {
    const configDir = await makeTempDir()
    const contentDir = path.join(configDir, 'docs')
    await writeFile(path.join(configDir, 'mdsite.yml'), [
      'content:',
      '  path: docs',
      'site:',
      '  name: Root Config Docs',
      ''
    ].join('\n'), 'utf8')
    await mkdir(contentDir, { recursive: true })
    await writeFile(path.join(contentDir, 'index.md'), '# Docs Index', 'utf8')

    const loaded = await loadMdsiteConfig(configDir)

    expect(loaded.configDir).toBe(configDir)
    expect(loaded.configPath).toBe(path.join(configDir, 'mdsite.yml'))
    expect(loaded.contentDir).toBe(contentDir)
    expect(loaded.config.content).toEqual({ path: 'docs' })
  })

  it('resolveContentOutputPath resolves the configured output relative to the content directory', () => {
    const contentDir = '/tmp/example'

    expect(resolveContentOutputPath(contentDir, {
      favicon: '',
      features: { bibleTooltips: true, sourceEdit: true },
      menu: [],
      server: { output: 'public/site', path: '.mdsite', repo: 'repo' },
      site: { canonical: '', name: 'Docs' },
      themes: { light: { colors: {} }, dark: { colors: {} } }
    })).toBe(path.resolve(contentDir, 'public', 'site', 'public'))
  })
})
