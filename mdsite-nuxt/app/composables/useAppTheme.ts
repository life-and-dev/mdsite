import { useTheme as useVuetifyTheme } from 'vuetify'

export type ThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'theme-preference'

export const useAppTheme = () => {
  const vuetifyTheme = useVuetifyTheme()

  // Get the current theme preference from localStorage
  const getStoredTheme = (): ThemeMode | null => {
    if (import.meta.client) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode
      return stored && ['light', 'dark'].includes(stored) ? stored : null
    }
    return null
  }

  // Get system theme preference
  const getSystemTheme = (): ThemeMode => {
    if (import.meta.client && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  }

  // Store theme preference in localStorage
  const setStoredTheme = (theme: ThemeMode) => {
    if (import.meta.client) {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }

  // Reactive theme preference
  const themePreference = ref<ThemeMode>('light')

  // Apply theme to Vuetify
  const applyTheme = (theme: ThemeMode) => {
    // Use the new Vuetify 3.7+ API: theme.change()
    if (vuetifyTheme && typeof (vuetifyTheme as any).change === 'function') {
      (vuetifyTheme as any).change(theme)
    } else if (vuetifyTheme.global) {
      // Fallback for older versions
      vuetifyTheme.global.name.value = theme
    }
  }

  // Set theme preference and apply it
  const setTheme = (theme: ThemeMode) => {
    themePreference.value = theme
    setStoredTheme(theme)
    applyTheme(theme)
  }

  // Toggle between light and dark
  const toggleTheme = () => {
    const newTheme: ThemeMode = themePreference.value === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
  }

  // Initialize theme on mount
  onMounted(() => {
    const storedTheme = getStoredTheme()
    const initialTheme = storedTheme || getSystemTheme()

    themePreference.value = initialTheme
    applyTheme(initialTheme)

    // Listen for system theme changes if no user preference
    if (import.meta.client && !storedTheme) {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      media.addEventListener('change', (e) => {
        // Only react to system changes if user hasn't manually set a valid preference (optional logic, but matches typical behavior)
        // For now, let's just update if no stored theme
        if (!getStoredTheme()) {
          const newSystemTheme = e.matches ? 'dark' : 'light'
          themePreference.value = newSystemTheme
          applyTheme(newSystemTheme)
        }
      })
    }
  })

  return {
    themePreference: readonly(themePreference),
    setTheme,
    toggleTheme,
  }
}
