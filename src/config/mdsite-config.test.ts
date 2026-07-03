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
    expect(loaded.config.footer).toEqual([])
    expect(loaded.config.server).toEqual({
      output: 'dist/public',
      path: '.renderer',
      repo: 'https://github.com/life-and-dev/mdsite',
      gitBranch: 'main'
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

  it('loadMdsiteConfig reads footer: as a flat string array', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Home', 'utf8')
    await writeFile(path.join(contentDir, 'about.md'), '# About', 'utf8')
    await writeFile(path.join(contentDir, 'contacts.md'), '# Contacts', 'utf8')
    await writeFile(path.join(contentDir, 'mdsite.yml'), [
      'footer:',
      '  - about',
      '  - contacts',
      '  - not-a-string: 1',
      ''
    ].join('\n'), 'utf8')

    const loaded = await loadMdsiteConfig(contentDir)

    expect(loaded.config.footer).toEqual(['about', 'contacts'])
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

  it('loadMdsiteConfig resolves the content string shorthand relative to the config directory', async () => {
    const configDir = await makeTempDir()
    const contentDir = path.join(configDir, 'content')
    await writeFile(path.join(configDir, 'mdsite.yml'), [
      'content: content',
      'site:',
      '  name: Shorthand Content',
      ''
    ].join('\n'), 'utf8')
    await mkdir(contentDir, { recursive: true })
    await writeFile(path.join(contentDir, 'index.md'), '# Shorthand Index', 'utf8')

    const loaded = await loadMdsiteConfig(configDir)

    expect(loaded.contentDir).toBe(contentDir)
    expect(loaded.config.content).toEqual({ path: 'content' })
  })

  it('resolveContentOutputPath resolves the configured output relative to the content directory', () => {
    const contentDir = '/tmp/example'

    expect(resolveContentOutputPath(contentDir, {
      favicon: '',
      features: { bibleTooltips: true, sourceEdit: true },
      menu: [],
      footer: [],
      server: { output: 'public/site', path: '.mdsite', repo: 'repo', gitBranch: 'main' },
      site: { canonical: '', name: 'Docs' },
      themes: { light: { colors: {} }, dark: { colors: {} } }
    })).toBe(path.resolve(contentDir, 'public', 'site', 'public'))
  })

  it('loadMdsiteConfig reads server.git-branch and defaults to "main" when missing or blank', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Home', 'utf8')

    const writeConfig = (branch?: string) => writeFile(
      path.join(contentDir, 'mdsite.yml'),
      branch === undefined
        ? 'site:\n  name: Home\n'
        : `site:\n  name: Home\nserver:\n  git-branch: ${branch}\n`,
      'utf8'
    )

    // Missing -> default 'main'
    await writeConfig()
    const defaulted = await loadMdsiteConfig(contentDir)
    expect(defaulted.config.server.gitBranch).toBe('main')

    // Explicit value -> preserved
    await writeConfig('develop')
    const customized = await loadMdsiteConfig(contentDir)
    expect(customized.config.server.gitBranch).toBe('develop')

    // Blank string -> default 'main'
    await writeConfig('   ')
    const blanked = await loadMdsiteConfig(contentDir)
    expect(blanked.config.server.gitBranch).toBe('main')
  })
})
