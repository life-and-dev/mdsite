import { relative, normalize, posix } from 'pathe'

/**
 * Generate source edit URL for the current page
 */
export function useSourceEdit() {
    const route = useRoute()
    const siteConfig = useSiteConfig()

    /**
     * Calculate the subdirectory within the git repo where content is located
     */
    function getContentSubdirectory(): string {
        const gitPath = normalize(siteConfig.contentGitPath)
        const contentPath = normalize(siteConfig.contentPath)

        // Calculate relative path from git root to content directory
        const subdir = relative(gitPath, contentPath)

        // Convert to posix path for GitHub URLs (forward slashes)
        return subdir ? posix.normalize(subdir) : ''
    }

    /**
     * Generate source edit URL for current route
     * @returns source edit URL or undefined if not enabled or not a content page
     */
    function getEditUrl(): string | undefined {
        const path = route.path
        const repo = siteConfig.contentGitRepo

        // Check if feature is enabled
        if (!siteConfig.features.sourceEdit) {
            return undefined
        }

        // Only render if repo starts with "https://github.com" (current supported provider)
        if (!repo || !repo.startsWith('https://github.com')) {
            return undefined
        }

        var contentPath: string;

        // Home page path
        if (!path || path === '/') {
            contentPath = 'index'
        }

        // Convert route path to content file path
        // Example: /church/evolution/312-constantine → https://github.com/life-and-dev/church/blob/main/evolution/312-constantine.md
        else {
            contentPath = path.startsWith('/') ? path.slice(1) : path
        }

        // Get the subdirectory within the git repo
        const subdir = getContentSubdirectory()

        // Build the full path: subdirectory + content file path
        const fullPath = subdir
            ? `${subdir}/${contentPath}.md`
            : `${contentPath}.md`

        return `${repo}/blob/${siteConfig.contentGitBranch}/${fullPath}`
    }

    return {
        getEditUrl
    }
}
