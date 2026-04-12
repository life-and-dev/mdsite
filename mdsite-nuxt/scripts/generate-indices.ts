#!/usr/bin/env node

import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'
import { parse as parseYaml } from 'yaml'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ----------------------------------------------------------------------------
// SHARED TYPES & HELPERS
// ----------------------------------------------------------------------------

/**
 * Get content domain from environment variable
 */
function getContentDomain(): string {
    return process.env.CONTENT || 'cms'
}

/**
 * Get source directory for content domain
 */
function getSourceDir(): string {
    if (process.env.CONTENT_DIR) return process.env.CONTENT_DIR
    return path.resolve(__dirname, '..', '../../md-content', getContentDomain())
}

/**
 * Get target public directory
 */
function getTargetDir(): string {
    return path.resolve(__dirname, '..', 'public')
}

/**
 * Extract H1 title from markdown content
 */
function extractH1Title(content: string): string | null {
    const h1Match = content.match(/^#\s+(.+)$/m)
    return h1Match?.[1]?.trim() ?? null
}

/**
 * Extract frontmatter metadata from markdown content
 * Unified to support both navigation (description) and search (keywords)
 */
function extractMarkdownMetadata(content: string): {
    title: string | null
    description?: string
    keywords?: string[]
} {
    const title = extractH1Title(content)

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
    const frontmatter = frontmatterMatch?.[1]

    if (!frontmatter) {
        return { title }
    }

    // Extract description
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
    const description = descMatch?.[1]?.trim()

    // Extract keywords (YAML array format)
    const keywordsMatch = frontmatter.match(/^keywords:\s*\[(.*)\]$/m)
    const keywordsStr = keywordsMatch?.[1]
    let keywords: string[] | undefined
    if (keywordsStr) {
        keywords = keywordsStr
            .split(',')
            .map(k => k.trim().replace(/['"]/g, ''))
            .filter(Boolean)
    }

    return { title, description, keywords }
}

/**
 * Get markdown file path from relative path
 */
function getMarkdownPath(relativePath: string): string {
    const sourceDir = getSourceDir()
    // If it already has an extension, don't append .md
    if (relativePath.endsWith('.md')) {
        return path.join(sourceDir, relativePath)
    }
    return path.join(sourceDir, `${relativePath}.md`)
}

// ----------------------------------------------------------------------------
// NAVIGATION LOGIC
// ----------------------------------------------------------------------------

/**
 * Minimal navigation tree node for client consumption
 */
export interface MinimalTreeNode {
    id: string
    title: string
    path: string
    type: 'link' | 'separator' | 'header' | 'external'
    children?: MinimalTreeNode[]
    description?: string
    isPrimary?: boolean
}

type MenuItemType = string | { [key: string]: string | null | MenuItemType[] } | null

/**
 * Resolve relative/absolute paths in menu
 */
function resolvePath(menuPath: string, contextPath: string): string {
    // Absolute path
    if (menuPath.startsWith('/')) {
        return menuPath
    }

    // Parent directory (..)
    if (menuPath.startsWith('../')) {
        const contextSegments = contextPath.split('/').filter(Boolean)
        contextSegments.pop() // Remove last segment
        const relativePart = menuPath.substring(3) // Remove '../'
        return contextSegments.length > 0
            ? `/${contextSegments.join('/')}/${relativePart}`
            : `/${relativePart}`
    }

    // Current directory (./)
    if (menuPath.startsWith('./')) {
        const relativePart = menuPath.substring(2)
        return contextPath === '/' ? `/${relativePart}` : `${contextPath}/${relativePart}`
    }

    // Relative to context (no prefix)
    return contextPath === '/' ? `/${menuPath}` : `${contextPath}/${menuPath}`
}

/**
 * Process menu items recursively and build minimal tree structure
 */
async function processMenuItems(
    items: MenuItemType[],
    contextPath: string,
    order: number = 0
): Promise<{ nodes: MinimalTreeNode[], nextOrder: number }> {
    const nodes: MinimalTreeNode[] = []

    for (const item of items) {
        // Handle null/blank (separator) - legacy support
        if (item === null) {
            nodes.push({
                id: `separator-${order}`,
                title: '---',
                path: `${contextPath}/__separator-${order}`,
                type: 'separator'
            })
            order++
            continue
        }

        // Handle string items
        if (typeof item === 'string') {
            // Check for separator marker
            if (item === '===') {
                nodes.push({
                    id: `separator-${order}`,
                    title: '---',
                    path: `${contextPath}/__separator-${order}`,
                    type: 'separator'
                })
                order++
                continue
            }

            // String → lookup H1 and description from markdown file
            const resolvedPath = resolvePath(item, contextPath)
            const markdownPath = getMarkdownPath(resolvedPath)

            let title: string | null = null
            let description: string | undefined = undefined

            try {
                if (await fs.pathExists(markdownPath)) {
                    const content = await fs.readFile(markdownPath, 'utf-8')
                    const metadata = extractMarkdownMetadata(content)
                    title = metadata.title
                    description = metadata.description
                }
            } catch (e) {
                // Ignore missing files
            }

            nodes.push({
                id: `${resolvedPath.split('/').filter(Boolean).pop() || 'home'}-${order}`,
                title: title || item,
                path: resolvedPath,
                type: 'link',
                description,
                isPrimary: true
            })
            order++
            continue
        }

        // Handle object (custom title, external link, header, or submenu)
        if (typeof item === 'object') {
            for (const [key, value] of Object.entries(item)) {
                // Handle header marker (value === '===')
                if (value === '===') {
                    nodes.push({
                        id: `header-${order}`,
                        title: key,
                        path: `${contextPath}/__header-${order}`,
                        type: 'header'
                    })
                    order++
                    continue
                }

                // Handle null/empty value (legacy header support)
                if (value === null || value === '') {
                    nodes.push({
                        id: `header-${order}`,
                        title: key,
                        path: `${contextPath}/__header-${order}`,
                        type: 'header'
                    })
                    order++
                    continue
                }

                // Handle external URL
                if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
                    nodes.push({
                        id: `external-${order}`,
                        title: key,
                        path: value,
                        type: 'external'
                    })
                    order++
                    continue
                }

                // Handle submenu (array value) - key is markdown filename
                if (Array.isArray(value)) {
                    const submenuPath = resolvePath(key, contextPath)
                    const markdownPath = getMarkdownPath(submenuPath)

                    let title: string | null = null
                    let description: string | undefined = undefined

                    try {
                        if (await fs.pathExists(markdownPath)) {
                            const content = await fs.readFile(markdownPath, 'utf-8')
                            const metadata = extractMarkdownMetadata(content)
                            title = metadata.title
                            description = metadata.description
                        }
                    } catch (e) {
                        // Ignore missing files
                    }

                    // Process children recursively
                    const { nodes: childNodes } = await processMenuItems(value, submenuPath, 0)

                    nodes.push({
                        id: `${submenuPath.split('/').filter(Boolean).pop() || 'home'}-${order}`,
                        title: title || key,
                        path: submenuPath,
                        type: 'link',
                        description,
                        isPrimary: true,
                        children: childNodes
                    })
                    order++
                    continue
                }

                // Handle custom title with path (alias link)
                if (typeof value === 'string') {
                    const resolvedPath = resolvePath(value, contextPath)
                    const markdownPath = getMarkdownPath(resolvedPath)
                    let description: string | undefined = undefined

                    try {
                        if (await fs.pathExists(markdownPath)) {
                            const content = await fs.readFile(markdownPath, 'utf-8')
                            const metadata = extractMarkdownMetadata(content)
                            description = metadata.description
                        }
                    } catch (e) {
                        // Ignore missing files
                    }

                    nodes.push({
                        id: `link-${key.replace(/\s+/g, '-').toLowerCase()}-${order}`,
                        title: key,
                        path: resolvedPath,
                        type: 'link',
                        description,
                        isPrimary: false // Aliases are NOT primary
                    })
                    order++
                }
            }
        }
    }

    return { nodes, nextOrder: order }
}

/**
 * Count total nodes in tree
 */
function countNodes(nodes: MinimalTreeNode[]): number {
    let count = nodes.length
    for (const node of nodes) {
        if (node.children) {
            count += countNodes(node.children)
        }
    }
    return count
}

/**
 * Generate navigation JSON file
 */
export async function generateNavigationJson() {
    const domain = getContentDomain()
    console.log(`📋 Building navigation tree for: ${domain}`)

    const sourceDir = getSourceDir()
    let menuPath = path.join(sourceDir, '_menu.yml')

    if (!await fs.pathExists(menuPath)) {
        menuPath = path.join(sourceDir, '_menu.yaml')
    }

    let tree: MinimalTreeNode[] = []
    try {
        if (await fs.pathExists(menuPath)) {
            const menuContent = await fs.readFile(menuPath, 'utf-8')
            const menuItems = parseYaml(menuContent) as MenuItemType[]
            const result = await processMenuItems(menuItems, '/')
            tree = result.nodes
        } else {
            console.warn('⚠️ No _menu.yml or _menu.yaml found at:', menuPath)
        }
    } catch (error) {
        console.error('Error building navigation tree:', error)
    }

    const targetDir = getTargetDir()
    const outputPath = path.join(targetDir, '_navigation.json')

    await fs.ensureDir(targetDir)
    await fs.writeJson(outputPath, tree, { spaces: 2 })

    const fileSize = (await fs.stat(outputPath)).size
    const fileSizeKB = (fileSize / 1024).toFixed(2)

    console.log(`✓ Navigation tree generated: ${outputPath} (${fileSizeKB} KB)`)
    console.log(`✓ Total menu items: ${countNodes(tree)}\n`)
}


// ----------------------------------------------------------------------------
// SEARCH INDEX LOGIC
// ----------------------------------------------------------------------------

export interface SearchIndexEntry {
    path: string
    title: string
    description?: string
    keywords?: string[]
    excerpt?: string
}

/**
 * Extract excerpt from markdown content (first 150 chars after frontmatter and H1)
 */
function extractExcerpt(content: string): string | undefined {
    // Remove frontmatter
    let cleanContent = content.replace(/^---\n[\s\S]*?\n---\n/, '')

    // Remove H1
    cleanContent = cleanContent.replace(/^#\s+.+$/m, '')

    // Get first paragraph, trim whitespace
    const firstParagraph = cleanContent.trim().split('\n\n')[0]
    if (!firstParagraph) return undefined

    // Trim to 150 chars
    const excerpt = firstParagraph.trim().substring(0, 150)
    return excerpt.length > 0 ? excerpt : undefined
}

/**
 * Convert file path to URL path
 */
function filePathToUrlPath(filePath: string, sourceDir: string): string {
    const relativePath = path.relative(sourceDir, filePath)
    const urlPath = '/' + relativePath
        .replace(/\.md$/, '')
        .replace(/index$/, '')
        .replace(/\\/g, '/')
        .replace(/\/+$/, '')

    return urlPath === '' ? '/' : urlPath
}

/**
 * Get all markdown files recursively
 */
async function getAllMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    if (!await fs.pathExists(dir)) {
        return files
    }

    const items = await fs.readdir(dir)

    for (const item of items) {
        const itemPath = path.join(dir, item)
        const stat = await fs.stat(itemPath)

        if (stat.isDirectory()) {
            const subFiles = await getAllMarkdownFiles(itemPath)
            files.push(...subFiles)
        } else if (item.endsWith('.md') && !item.endsWith('.draft.md')) {
            // Only include published markdown files
            files.push(itemPath)
        }
    }

    return files
}

/**
 * Generate search index JSON file
 */
export async function generateSearchIndexJson() {
    const domain = getContentDomain()
    console.log(`🔍 Building search index for: ${domain}`)

    const sourceDir = getSourceDir()
    const markdownFiles = await getAllMarkdownFiles(sourceDir)

    const index: SearchIndexEntry[] = []

    for (const filePath of markdownFiles) {
        try {
            const content = await fs.readFile(filePath, 'utf-8')
            const metadata = extractMarkdownMetadata(content)
            const excerpt = extractExcerpt(content)
            const urlPath = filePathToUrlPath(filePath, sourceDir)

            // Skip files without H1 (malformed)
            if (!metadata.title) {
                console.warn(`⚠️  No H1 found in: ${path.relative(sourceDir, filePath)}`)
                continue
            }

            index.push({
                path: urlPath,
                title: metadata.title,
                description: metadata.description,
                keywords: metadata.keywords,
                excerpt
            })
        } catch (error) {
            console.error(`❌ Failed to process ${filePath}:`, error)
        }
    }

    const targetDir = getTargetDir()
    const outputPath = path.join(targetDir, '_search-index.json')

    await fs.ensureDir(targetDir)
    await fs.writeJson(outputPath, index, { spaces: 2 })

    const fileSize = (await fs.stat(outputPath)).size
    const fileSizeKB = (fileSize / 1024).toFixed(2)

    console.log(`✓ Search index generated: ${outputPath} (${fileSizeKB} KB)`)
    console.log(`✓ Total indexed pages: ${index.length}\n`)
}

// ----------------------------------------------------------------------------
// MAIN EXECUTION
// ----------------------------------------------------------------------------

export async function buildContentData() {
    await generateNavigationJson()
    await generateSearchIndexJson()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    buildContentData().catch((error) => {
        console.error(error)
        process.exit(1)
    })
}
