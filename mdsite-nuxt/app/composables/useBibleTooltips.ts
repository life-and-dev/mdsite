/**
 * Composable for managing Bible tooltip scanning on page content
 * Automatically scans content when it becomes available and re-scans on changes
 */
export function useBibleTooltips(pageRef: Ref<any>) {
  const { $bibleTooltips } = useNuxtApp()

  onMounted(() => {
    // Initial scan if page is already loaded
    if (pageRef.value) {
      nextTick(() => $bibleTooltips.scan())
    }

    // Watch for content changes and re-scan
    watch(pageRef, (newPage) => {
      if (newPage) {
        nextTick(() => $bibleTooltips.scan())
      }
    })
  })
}
