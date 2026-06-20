/**
 * Manage sidebar visibility state (no persistence)
 */
export function useSidebarState() {
  const { mdAndUp } = useDisplay()

  // Default: open on md+, closed on sm-
  const isOpen = ref(false)

  /**
   * Initialize sidebar state based on screen size
   */
  function initialize() {
    isOpen.value = mdAndUp.value
  }

  /**
   * Toggle sidebar visibility
   */
  function toggle() {
    isOpen.value = !isOpen.value
  }

  /**
   * Open sidebar
   */
  function open() {
    isOpen.value = true
  }

  /**
   * Close sidebar
   */
  function close() {
    isOpen.value = false
  }

  /**
   * Reset to default state based on screen size
   */
  function reset() {
    isOpen.value = mdAndUp.value
  }

  // Watch for screen size changes
  watch(mdAndUp, (newValue) => {
    isOpen.value = newValue
  })

  // Initialize on mount
  onMounted(() => {
    initialize()
  })

  return {
    isOpen,
    toggle,
    open,
    close,
    reset
  }
}
