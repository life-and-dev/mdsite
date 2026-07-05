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
    expect(config.paths.output).toBe('.output')
  })

  it('buildDefaultMdsiteConfig auto-detects favicon, source-edit, input dir, and README site name together', async () => {
    const contentDir = await makeTempDir()
    await mkdir(path.join(contentDir, 'docs'), { recursive: true })
    await writeFile(path.join(contentDir, 'docs', 'README.md'), '# Readme Title', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'favicon.ico'), 'x', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'guide.md'), '# Guide', 'utf8')
    await mkdir(path.join(contentDir, '.git'), { recursive: true })
    await writeFile(
      path.join(contentDir, '.git', 'config'),
      '[remote "origin"]\n\turl = git@github.com:owner/repo.git\n',
      'utf8'
    )
    await writeFile(path.join(contentDir, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8')

    const config = await buildDefaultMdsiteConfig(contentDir)

    expect(config.site.name).toBe('Readme Title')
    expect(config.site.favicon).toBe('favicon.ico')
    expect(config.features.sourceEdit).toBe('https://github.com/owner/repo/blob/main/')
    expect(config.site.canonical).toBe('https://owner.github.io/repo')
    expect(config.paths.input).toBe('docs')
    expect(config.menu).toEqual(['guide'])
  })

  it('buildDefaultMdsiteConfig leaves smart defaults blank when nothing can be detected', async () => {
    const contentDir = await makeTempDir()

    const config = await buildDefaultMdsiteConfig(contentDir)

    expect(config.site.name).toBe('')
    expect(config.site.favicon).toBe('')
    expect(config.site.canonical).toBe('')
    expect(config.features.sourceEdit).toBe('')
    expect(config.paths.input).toBe('')
    expect(config.menu).toEqual([])
  })

  it('buildDefaultMdsiteConfig scopes menu, site name, and favicon to docs/ when input dir is detected', async () => {
    const contentDir = await makeTempDir()
    await mkdir(path.join(contentDir, 'docs', 'guides'), { recursive: true })
    await writeFile(path.join(contentDir, 'docs', 'index.md'), '# Home', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'README.md'), '# Docs Readme', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'AGENTS.md'), '# Docs Agents', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'favicon.png'), 'x', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'intro.md'), '# Intro', 'utf8')
    await writeFile(path.join(contentDir, 'docs', 'guides', 'alpha.md'), '# Alpha', 'utf8')
    // Root-level files outside docs/ must NOT drive detection.
    await writeFile(path.join(contentDir, 'root-page.md'), '# Root', 'utf8')
    await writeFile(path.join(contentDir, 'README.md'), '# Project Readme', 'utf8')
    await writeFile(path.join(contentDir, 'favicon.ico'), 'x', 'utf8')

    const config = await buildDefaultMdsiteConfig(contentDir)

    expect(config.paths.input).toBe('docs')
    // index.md (homepage), README.md, AGENTS.md excluded; paths relative to docs/.
    expect(config.menu).toEqual(['guides/alpha', 'intro'])
    // Site name + favicon come from docs/, not the project root.
    expect(config.site.name).toBe('Docs Readme')
    expect(config.site.favicon).toBe('favicon.png')
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
      'features:',
      '  bible-tooltips: false',
      'menu:',
      '  - custom/page',
      'paths:',
      '  output: dist/public',
      '  build: .renderer',
      'site:',
      '  favicon: assets/favicon.svg',
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
    expect(loaded.config.site.favicon).toBe('assets/favicon.svg')
    expect(loaded.config.features).toEqual({
      bibleTooltips: false,
      sourceEdit: '',
      footer: []
    })
    expect(loaded.config.menu).toEqual(['custom/page'])
    expect(loaded.config.features.footer).toEqual([])
    expect(loaded.config.paths).toEqual({
      input: '',
      build: '.renderer',
      output: 'dist/public'
    })
    expect(loaded.config.site).toEqual({
      canonical: 'https://example.test',
      favicon: 'assets/favicon.svg',
      name: 'Derived Name'
    })
    expect(loaded.config.themes.light.colors.primary).toBe('#123456')
    expect(loaded.config.themes.light.colors.background).toBe('#f6f8fa')
    expect(loaded.config.themes.dark.colors.outline).toBe('#abcdef')
    expect(loaded.config.themes.dark.colors.primary).toBe('#58a6ff')
  })

  it('loadMdsiteConfig reads features.footer: as a flat string array', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'index.md'), '# Home', 'utf8')
    await writeFile(path.join(contentDir, 'about.md'), '# About', 'utf8')
    await writeFile(path.join(contentDir, 'contacts.md'), '# Contacts', 'utf8')
    await writeFile(path.join(contentDir, 'mdsite.yml'), [
      'features:',
      '  footer:',
      '    - about',
      '    - contacts',
      '    - not-a-string: 1',
      ''
    ].join('\n'), 'utf8')

    const loaded = await loadMdsiteConfig(contentDir)

    expect(loaded.config.features.footer).toEqual(['about', 'contacts'])
  })

  it('loadMdsiteConfig accepts menu-shaped footer entries (custom labels, external URLs, separators)', async () => {
    const contentDir = await makeTempDir()
    await writeFile(path.join(contentDir, 'about.md'), '# About', 'utf8')
    await writeFile(path.join(contentDir, 'mdsite.yml'), [
      'features:',
      '  footer:',
      '    - about',
      '    - "About Page": about',
      '    - "GitHub Repo": https://github.com/life-and-dev/mdsite',
      '    - null',
      '    - "Multi":',
      '        - nested: not allowed',
      '    - { too: many, keys: true }',
      ''
    ].join('\n'), 'utf8')

    const loaded = await loadMdsiteConfig(contentDir)

    expect(loaded.config.features.footer).toEqual([
      'about',
      { 'About Page': 'about' },
      { 'GitHub Repo': 'https://github.com/life-and-dev/mdsite' },
      null,
    ])
  })

  it('loadMdsiteConfig resolves paths.input relative to the config directory', async () => {
    const configDir = await makeTempDir()
    const contentDir = path.join(configDir, 'docs')
    await writeFile(path.join(configDir, 'mdsite.yml'), [
      'paths:',
      '  input: docs',
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
    expect(loaded.config.paths.input).toBe('docs')
  })

  it('loadMdsiteConfig resolves the paths.input string shorthand relative to the config directory', async () => {
    const configDir = await makeTempDir()
    const contentDir = path.join(configDir, 'content')
    await writeFile(path.join(configDir, 'mdsite.yml'), [
      'paths:',
      '  input: content',
      'site:',
      '  name: Shorthand Content',
      ''
    ].join('\n'), 'utf8')
    await mkdir(contentDir, { recursive: true })
    await writeFile(path.join(contentDir, 'index.md'), '# Shorthand Index', 'utf8')

    const loaded = await loadMdsiteConfig(configDir)

    expect(loaded.contentDir).toBe(contentDir)
    expect(loaded.config.paths.input).toBe('content')
  })

  it('resolveContentOutputPath resolves the configured output relative to the content directory', () => {
    const contentDir = '/tmp/example'

    expect(resolveContentOutputPath(contentDir, {
      features: { bibleTooltips: true, sourceEdit: '', footer: [] },
      menu: [],
      paths: { input: '', build: '.mdsite', output: 'public/site' },
      site: { canonical: '', favicon: '', name: 'Docs' },
      themes: { light: { colors: {} }, dark: { colors: {} } }
    })).toBe(path.resolve(contentDir, 'public', 'site', 'public'))
  })
})
