export interface BreadcrumbItem {
  title: string
  path: string
}

/**
 * Extract fallback title from path
 */
function getFallbackTitle(pagePath: string, siteName?: string): string {
  if (pagePath === '/') return siteName || 'Home'
  return pagePath.split('/').filter(Boolean).pop() || 'Page'
}

/**
 * Generate breadcrumb array from a given path
 * @param path - Route path (e.g., '/church/history/messianic')
 * @returns Array of breadcrumb items
 */
export async function generateBreadcrumbs(path: string): Promise<BreadcrumbItem[]> {
  const segments = path.split('/').filter(Boolean)
  const { siteName } = useSiteConfig()

  // Build full path array for querying (includes root)
  const paths: string[] = ['/']
  for (let i = 0; i < segments.length; i++) {
    paths.push('/' + segments.slice(0, i + 1).join('/'))
  }

  // Query all pages to get titles
  const pageTitles = new Map<string, string>()

  for (const pagePath of paths) {
    try {
      const page = await queryCollection('content').path(pagePath).first()
      pageTitles.set(pagePath, page?.title || getFallbackTitle(pagePath, siteName))
    } catch {
      pageTitles.set(pagePath, getFallbackTitle(pagePath, siteName))
    }
  }

  // Build breadcrumb items based on path depth
  const breadcrumbs: BreadcrumbItem[] = []

  if (segments.length <= 3) {
    // Show root + all segments
    for (const currentPath of paths) {
      breadcrumbs.push({
        title: pageTitles.get(currentPath) || getFallbackTitle(currentPath, siteName),
        path: currentPath
      })
    }
  } else {
    // Show ellipsis + last 3 segments
    // For /a/b/c/d: show ... > b > c > d, ellipsis links to /a
    const firstVisibleIndex = segments.length - 3
    const ellipsisPath = '/' + segments.slice(0, firstVisibleIndex).join('/')

    breadcrumbs.push({ title: '...', path: ellipsisPath })

    for (let i = firstVisibleIndex; i < segments.length; i++) {
      const segmentPath = '/' + segments.slice(0, i + 1).join('/')
      breadcrumbs.push({
        title: pageTitles.get(segmentPath) || segments[i] || 'Page',
        path: segmentPath
      })
    }
  }

  return breadcrumbs
}
