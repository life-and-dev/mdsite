import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { MenuItem } from './mdsite-config.js'

const ignoredDirectories = new Set([
  '.git',
  '.mdsite',
  '.mdsite-runtime',
  '.output',
  'dist',
  'mdsite-nuxt',
  'node_modules'
])

export async function deriveSiteNameFromIndex(contentDir: string): Promise<string> {
  const indexPath = path.join(contentDir, 'index.md')

  try {
    const content = await readFile(indexPath, 'utf8')
    const match = content.match(/^#\s+(.+)$/m)
    return match?.[1]?.trim() || 'MD Site'
  } catch {
    return 'MD Site'
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

    if (entry.name === '_menu.yml' || entry.name === '_menu.yaml') {
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
