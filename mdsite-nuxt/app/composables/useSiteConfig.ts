interface SiteConfig {
  siteName: string
  siteCanonical: string
  contentGitRepo: string
  contentGitBranch: string
  contentGitPath: string
  contentPath: string
  features: {
    bibleTooltips: boolean
    sourceEdit: boolean
  }
  themeColorLight: string
  themeColorDark: string
}

/**
 * Get site configuration based on runtime config
 */
export function useSiteConfig(): SiteConfig {
  const config = useRuntimeConfig()
  const siteConfig = config.public.siteConfig as any

  return {
    siteName: siteConfig?.site?.name || '',
    siteCanonical: siteConfig?.site?.canonical || '',
    contentGitRepo: '',
    contentGitBranch: 'main',
    contentGitPath: '.',
    contentPath: config.public.contentPath || '.',
    features: {
      bibleTooltips: siteConfig?.features?.bibleTooltips ?? false,
      sourceEdit: siteConfig?.features?.sourceEdit ?? false
    },
    themeColorLight: siteConfig?.themes?.light?.colors?.primary || '#000000',
    themeColorDark: siteConfig?.themes?.dark?.colors?.primary || '#ffffff'
  }
}
