#!/usr/bin/env node

import chokidar from 'chokidar'
import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg']
const STATIC_FILES = [
    'favicon.ico',
    'favicon.svg',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'site.webmanifest',
    'robots.txt'
]
const MENU_FILES = ['_menu.yml', '_menu.yaml']
const LOGO_FILE = 'logo.svg'
const FAVICON_DIR = 'favicon'
const FAVICON_FILES = [
    'favicon.svg',
    'favicon.ico',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png'
]

// Debounce timers for JSON regeneration (5 second delay)
let navigationDebounceTimer: NodeJS.Timeout | null = null
let searchDebounceTimer: NodeJS.Timeout | null = null

/**
 * Get content domain from environment variable (read at runtime, not import time)
 */
function getContentDomain(): string {
    return process.env.CONTENT || 'cms'
}

/**
 * Get source directory for content domain
 */
function getSourceDir(): string {
    if (process.env.CONTENT_DIR) {
        return process.env.CONTENT_DIR
    }
    return path.resolve(__dirname, '..', '../../md-content', getContentDomain())
}

/**
 * Get target public directory
 */
function getTargetDir(): string {
    return path.resolve(__dirname, '..', 'public')
}

/**
 * Regenerate navigation JSON with debouncing (5 second delay)
 */
function regenerateNavigation() {
    if (navigationDebounceTimer) {
        clearTimeout(navigationDebounceTimer)
    }

    navigationDebounceTimer = setTimeout(async () => {
        console.log('🔄 Regenerating navigation tree...')
        try {
            const { generateNavigationJson } = await import('./generate-indices.js')
            await generateNavigationJson()
        } catch (error) {
            console.error('❌ Failed to regenerate navigation:', error)
        }
        navigationDebounceTimer = null
    }, 5000)
}

/**
 * Regenerate search index JSON with debouncing (5 second delay)
 */
function regenerateSearchIndex() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
    }

    searchDebounceTimer = setTimeout(async () => {
        console.log('🔄 Regenerating search index...')
        try {
            const { generateSearchIndexJson } = await import('./generate-indices.js')
            await generateSearchIndexJson()
        } catch (error) {
            console.error('❌ Failed to regenerate search index:', error)
        }
        searchDebounceTimer = null
    }, 5000)
}

/**
 * Generate navigation and search JSON files (one-time on startup)
 */
export async function generateJsonFiles() {
    console.log('🔨 Generating JSON files...')

    try {
        const { generateNavigationJson } = await import('./generate-indices.js')
        await generateNavigationJson()
    } catch (error) {
        console.error('❌ Failed to generate navigation:', error)
    }

    try {
        const { generateSearchIndexJson } = await import('./generate-indices.js')
        await generateSearchIndexJson()
    } catch (error) {
        console.error('❌ Failed to generate search index:', error)
    }
}

/**
 * Copy all images, menus, and favicons from content to public directory (one-time)
 */
export async function copyAllImages() {
    const sourceDir = getSourceDir()
    const targetDir = getTargetDir()

    console.log(`📦 Copying images, menus, and favicons from: ${sourceDir}`)
    console.log(`📦 Target directory: ${targetDir}`)

    let copiedCount = 0

    // Copy images (excluding logo.svg and favicon directory - handled separately)
    for (const ext of IMAGE_EXTS) {
        const files = await getAllFiles(sourceDir, ext)

        for (const sourcePath of files) {

            // Skip files in favicon directory - handled separately
            if (sourcePath.includes(`${path.sep}${FAVICON_DIR}${path.sep}`)) {
                continue
            }

            await copyImage(sourcePath, false)
            copiedCount++
        }
    }

    // Copy root menu file (check all supported names)
    for (const menuFile of MENU_FILES) {
        const rootMenuPath = path.join(sourceDir, menuFile)
        if (await fs.pathExists(rootMenuPath)) {
            await copyMenuFile(rootMenuPath, false)
            copiedCount++
        }
    }

    // Copy favicon files
    const faviconDir = path.join(sourceDir, FAVICON_DIR)
    if (await fs.pathExists(faviconDir)) {
        for (const faviconFile of FAVICON_FILES) {
            const sourcePath = path.join(faviconDir, faviconFile)
            if (await fs.pathExists(sourcePath)) {
                await copyFaviconFile(sourcePath, false)
                copiedCount++
            }
        }
    }

    console.log(`✓ Copied ${copiedCount} file(s)\n`)
}

/**
 * Clean public directory except static files
 */
export async function cleanPublicDirectory() {
    const targetDir = getTargetDir()

    console.log(`🧹 Cleaning public directory...`)

    if (!await fs.pathExists(targetDir)) {
        return
    }

    const items = await fs.readdir(targetDir)

    for (const item of items) {
        if (!STATIC_FILES.includes(item)) {
            const itemPath = path.join(targetDir, item)
            await fs.remove(itemPath)
            console.log(`  ✗ Removed: ${item}`)
        }
    }

    console.log(`✓ Public directory cleaned\n`)
}

/**
 * Watch images, markdown files, and menu files in content directory
 */
export async function startWatcher() {
    const sourceDir = getSourceDir()
    const targetDir = getTargetDir()

    // Clean public directory first (handles domain switching)
    await cleanPublicDirectory()

    // Copy all existing files BEFORE starting watcher (ensures files are ready)
    await copyAllImages()

    // Generate navigation and search JSON files
    await generateJsonFiles()

    console.log(`👀 Watching images, markdown, and menus in: ${sourceDir}`)
    console.log(`👀 Target directory: ${targetDir}\n`)

    const patterns = [
        ...IMAGE_EXTS.map(ext => `${sourceDir}/**/*.${ext}`),
        `${sourceDir}/**/*.md`,           // Watch all markdown files
        ...MENU_FILES.map(f => `${sourceDir}/${f}`) // Watch root menu files
    ]

    const watcher = chokidar.watch(patterns, {
        persistent: true,
        ignoreInitial: true, // Files already copied above
        awaitWriteFinish: {
            stabilityThreshold: 500,
            pollInterval: 100
        }
    })

    watcher
        .on('add', (filePath) => {
            const fileName = path.basename(filePath)
            if (MENU_FILES.includes(fileName)) {
                copyMenuFile(filePath, true, 'added')
                regenerateNavigation() // Menu change affects navigation
            } else if (fileName === LOGO_FILE) {
                handleLogoChange(filePath, 'added')
            } else if (fileName.endsWith('.md')) {
                // Markdown file added - regenerate both navigation and search
                console.log(`📝 Markdown added: ${fileName}`)
                regenerateNavigation()
                regenerateSearchIndex()
            } else {
                copyImage(filePath, true, 'added')
            }
        })
        .on('change', (filePath) => {
            const fileName = path.basename(filePath)
            if (MENU_FILES.includes(fileName)) {
                copyMenuFile(filePath, true, 'updated')
                regenerateNavigation() // Menu change affects navigation
            } else if (fileName === LOGO_FILE) {
                handleLogoChange(filePath, 'updated')
            } else if (fileName.endsWith('.md')) {
                // Markdown file changed - regenerate both navigation and search
                console.log(`📝 Markdown updated: ${fileName}`)
                regenerateNavigation()
                regenerateSearchIndex()
            } else {
                copyImage(filePath, true, 'updated')
            }
        })
        .on('unlink', (filePath) => {
            const fileName = path.basename(filePath)
            if (MENU_FILES.includes(fileName)) {
                deleteMenuFile(filePath)
                regenerateNavigation() // Menu deletion affects navigation
            } else if (fileName === LOGO_FILE) {
                console.log(`🗑️ Logo removed: ${fileName}`)
            } else if (fileName.endsWith('.md')) {
                // Markdown file deleted - regenerate both navigation and search
                console.log(`📝 Markdown deleted: ${fileName}`)
                regenerateNavigation()
                regenerateSearchIndex()
            } else {
                deleteImage(filePath)
            }
        })
        .on('error', (error) => console.error(`❌ Watcher error: ${error}`))

    return watcher
}

/**
 * One-time sync for production builds
 */
export async function syncContent() {
    await cleanPublicDirectory()
    await copyAllImages()
    await generateJsonFiles()
}

/**
 * Transform content path to public path (strips domain prefix)
 * Example: /content/kingdom/church/image.jpg → /public/church/image.jpg
 */
function getPublicPath(sourcePath: string): { relativePath: string, targetPath: string } {
    const sourceDir = getSourceDir()
    const targetDir = getTargetDir()
    // With generic sourceDir, we just calculate relative path
    const relativeFromSource = path.relative(sourceDir, sourcePath)
    const targetPath = path.join(targetDir, relativeFromSource)

    return { relativePath: relativeFromSource, targetPath }
}

/**
 * Copy a single file from content to public (images or menus)
 */
async function copyFile(
    sourcePath: string,
    fileType: 'Image' | 'Menu',
    log: boolean = true,
    action: string = 'copied'
) {
    try {
        // Check if this is a draft-only image (skip menus, they don't have draft checks)
        if (fileType === 'Image' && await isDraftOnlyImage(sourcePath)) {
            if (log) {
                const fileName = path.basename(sourcePath)
                console.log(`⊗ Skipped draft image: ${fileName}`)
            }
            return
        }

        const { relativePath, targetPath } = getPublicPath(sourcePath)

        await fs.ensureDir(path.dirname(targetPath))
        await fs.copy(sourcePath, targetPath)

        if (log) {
            console.log(`✓ ${fileType} ${action}: ${relativePath}`)
        }
    } catch (error) {
        console.error(`❌ Failed to copy ${sourcePath}:`, error)
    }
}

/**
 * Delete a single file from public directory (images or menus)
 */
async function deleteFile(sourcePath: string, fileType: 'Image' | 'Menu') {
    try {
        // Check if this was a draft-only image (skip menus)
        if (fileType === 'Image' && await isDraftOnlyImage(sourcePath)) {
            const fileName = path.basename(sourcePath)
            console.log(`⊗ Draft image removed from content: ${fileName}`)
            return
        }

        const { relativePath, targetPath } = getPublicPath(sourcePath)

        if (await fs.pathExists(targetPath)) {
            await fs.remove(targetPath)
            console.log(`✗ ${fileType} deleted: ${relativePath}`)
        }
    } catch (error) {
        console.error(`❌ Failed to delete ${sourcePath}:`, error)
    }
}

/**
 * Copy a single image from content to public
 */
async function copyImage(sourcePath: string, log: boolean = true, action: string = 'copied') {
    return copyFile(sourcePath, 'Image', log, action)
}

/**
 * Delete image from public directory
 */
async function deleteImage(sourcePath: string) {
    return deleteFile(sourcePath, 'Image')
}

/**
 * Copy a single _menu.yml file from content to public
 */
async function copyMenuFile(sourcePath: string, log: boolean = true, action: string = 'copied') {
    return copyFile(sourcePath, 'Menu', log, action)
}

/**
 * Delete _menu.yml file from public directory
 */
async function deleteMenuFile(sourcePath: string) {
    return deleteFile(sourcePath, 'Menu')
}

/**
 * Check if an image belongs to a draft-only page (no published .md exists)
 */
async function isDraftOnlyImage(imagePath: string): Promise<boolean> {
    const ext = path.extname(imagePath)
    const fileName = path.basename(imagePath, ext)

    // Extract page prefix from image name (e.g., "something.pic.jpg" → "something")
    const parts = fileName.split('.')
    if (parts.length < 2) {
        // Single-part filename (no prefix) - assume it's a shared image, copy it
        return false
    }

    const pagePrefix = parts[0]
    const imageDir = path.dirname(imagePath)

    // Check if corresponding published .md file exists
    const publishedMdPath = path.join(imageDir, `${pagePrefix}.md`)
    const hasPublishedVersion = await fs.pathExists(publishedMdPath)

    // Check if only draft version exists
    const draftMdPath = path.join(imageDir, `${pagePrefix}.draft.md`)
    const hasDraftVersion = await fs.pathExists(draftMdPath)

    // Skip copying if only draft exists (no published version)
    return !hasPublishedVersion && hasDraftVersion
}

/**
 * Copy a single favicon file from content to public
 */
async function copyFaviconFile(sourcePath: string, log: boolean = true, action: string = 'copied') {
    try {
        const targetDir = getTargetDir()
        const fileName = path.basename(sourcePath)
        const targetPath = path.join(targetDir, fileName)

        await fs.ensureDir(targetDir)
        await fs.copy(sourcePath, targetPath)

        if (log) {
            console.log(`✓ Favicon ${action}: ${fileName}`)
        }
    } catch (error) {
        console.error(`❌ Failed to copy favicon ${sourcePath}:`, error)
    }
}

/**
 * Handle logo.svg changes - regenerate favicons
 */
async function handleLogoChange(logoPath: string, action: string) {
    const domain = getContentDomain()
    console.log(`🎨 Logo ${action}, regenerating favicons for ${domain}...`)

    try {
        const { generateFavicons, copyFaviconsToPublic } = await import('./generate-favicons.js')
        const success = await generateFavicons(domain)

        if (success) {
            await copyFaviconsToPublic(domain)
            console.log(`✓ Favicons regenerated for ${domain}\n`)
        }
    } catch (error) {
        console.error(`❌ Failed to regenerate favicons:`, error)
    }
}

/**
 * Get all files with specific extension recursively
 */
async function getAllFiles(dir: string, ext: string): Promise<string[]> {
    const files: string[] = []

    if (!await fs.pathExists(dir)) {
        return files
    }

    const items = await fs.readdir(dir)

    for (const item of items) {
        const itemPath = path.join(dir, item)
        const stat = await fs.stat(itemPath)

        if (stat.isDirectory()) {
            const subFiles = await getAllFiles(itemPath, ext)
            files.push(...subFiles)
        } else if (item.toLowerCase().endsWith(`.${ext}`)) {
            files.push(itemPath)
        }
    }

    return files
}

// CLI Entry Point
if (process.argv[1] === __filename) {
    const args = process.argv.slice(2)

    ; (async () => {
        if (args.includes('--copy')) {
            await copyAllImages()
        } else if (args.includes('--sync')) {
            await syncContent()
        } else if (args.includes('--watch')) {
            await startWatcher()
        }
    })().catch((error) => {
        console.error(error)
        process.exit(1)
    })
}
