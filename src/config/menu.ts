import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { MenuItem } from './mdsite-config.js'

const ignoredDirectories = new Set([
  '.git',
  '.mdsite',
  '.output',
  'dist',
  'mdsite-nuxt',
  'node_modules'
])

/**
 * Markdown files excluded from the generated menu because they are repo/project
 * metadata, not site pages. Compared case-insensitively by basename.
 */
const excludedFiles = new Set([
  '_menu.yml',
  '_menu.yaml',
  'readme.md',
  'agents.md',
  'license.md',
  'contribution.md',
  'contributing.md',
  'security.md'
])

/**
 * Derive the site name from the first H1 heading. Prefers `README.md`, then
 * falls back to `index.md`. Returns `''` when neither file exists or has an
 * H1, so callers can leave the field blank for the user to fill in.
 */
export async function deriveSiteName(contentDir: string): Promise<string> {
  const fromReadme = await readFirstH1(path.join(contentDir, 'README.md'))
  if (fromReadme) return fromReadme

  const fromIndex = await readFirstH1(path.join(contentDir, 'index.md'))
  if (fromIndex) return fromIndex

  return ''
}

async function readFirstH1(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, 'utf8')
    const match = content.match(/^#\s+(.+)$/m)
    return match?.[1]?.trim() || null
  } catch {
    return null
  }
}

export async function generateMenuFromMarkdownFiles(contentDir: string): Promise<MenuItem[]> {
  const markdownFiles = await collectMarkdownFiles(contentDir)

  return markdownFiles
    .filter((filePath) => filePath !== 'index.md')
    .map((filePath) => toExtensionlessPath(filePath))
}

async function collectMarkdownFiles(rootDir: string, currentDir: string = rootDir): Promise<string[]> {
  const entries = await readdir(currentDir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name)
    const relativePath = path.relative(rootDir, absolutePath)

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.')) {
        continue
      }

      files.push(...await collectMarkdownFiles(rootDir, absolutePath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (excludedFiles.has(entry.name.toLowerCase())) {
      continue
    }

    if (!entry.name.endsWith('.md')) {
      continue
    }

    files.push(relativePath)
  }

  return files.sort((left, right) => left.localeCompare(right))
}

function toExtensionlessPath(filePath: string): string {
  return filePath.replace(/\.md$/i, '').split(path.sep).join('/')
}
