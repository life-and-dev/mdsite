import { useDisplay } from 'vuetify'

/**
 * Shared tooltip configuration for navigation and search components
 *
 * Desktop (≥960px): Tooltips appear to the right (end)
 * Mobile (<960px): Tooltips appear below (bottom)
 * Max-width: 600px to prevent overlap with 280px navigation bar
 */
export function useTooltipConfig() {
  const { mdAndUp } = useDisplay()

  const location = computed(() => mdAndUp.value ? 'end' : 'bottom')
  const maxWidth = 600

  return {
    location,
    maxWidth
  }
}
