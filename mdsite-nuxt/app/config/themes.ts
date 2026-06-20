import type { ThemeDefinition } from 'vuetify'
import { loadMdsiteConfigSync } from '../../utils/mdsite-config'

/**
 * Get theme configuration from the active mdsite config
 */
export function getDomainThemes(domain: string | undefined): Record<string, ThemeDefinition> {
  const themes = loadMdsiteConfigSync().config.themes as Record<string, ThemeDefinition>

  void domain

  for (const [name, theme] of Object.entries(themes)) {
    (theme as any).dark = name.toLowerCase().includes('dark')
  }

  return themes
}
