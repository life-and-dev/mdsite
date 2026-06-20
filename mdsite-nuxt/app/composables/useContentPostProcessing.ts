/**
 * Post-process content after ContentRenderer finishes rendering
 * Uses Vue's onUpdated lifecycle hook to detect when ContentRenderer completes rendering
 *
 * NOTE: Bible verses are now wrapped in <span class="bible-ref"> at BUILD TIME
 * via the content transformer (see content.config.ts and app/transformers/bible-verses.ts)
 * This composable only attaches event listeners to pre-existing spans.
 *
 * Strategy:
 * 1. Watch for page data arrival
 * 2. Use onUpdated() to run processing after ContentRenderer re-renders
 * 3. Guard flag prevents duplicate processing
 * 4. Let useTableOfContents handle "< 2 headings" check via DOM
 *
 * This follows the standard Vue pattern for "run code after component updates"
 */
export function useContentPostProcessing(pageRef: Ref<any>) {
  const { $bibleTooltips } = useNuxtApp()
  const layoutGenerateTOC = inject<() => void>('generateTOC')

  // Track if we've already processed the current page
  const processedPageId = ref<string | null>(null)

  /**
   * Process content: attach event listeners to Bible verses and generate TOC
   * Bible verses are already wrapped in spans at build time
   * Only runs once per page load
   */
  function processContent() {
    const currentPage = pageRef.value
    if (!currentPage) return

    // Prevent duplicate processing of the same page
    const pageId = currentPage.id || currentPage._path || currentPage.path
    if (processedPageId.value === pageId) return

    // Verify content actually exists in DOM (guard against spurious onUpdated calls)
    const contentContainer = document.querySelector('.content-body, article')
    if (!contentContainer) return

    const hasContent = contentContainer.querySelector('h1, h2, h3, p')
    if (!hasContent) return

    // Mark as processed BEFORE running operations to prevent re-entry
    processedPageId.value = pageId

    // Scan for Bible verse references (scoped to article content only)
    $bibleTooltips.scan(contentContainer as HTMLElement)

    // Generate TOC (useTableOfContents will handle the "< 2 headings" check)
    if (layoutGenerateTOC) {
      layoutGenerateTOC()
    }
  }

  /**
   * Reset processed flag when new page data arrives
   * This allows onUpdated to process the new content
   */
  watch(pageRef, (newPage) => {
    if (!newPage) return

    // Reset processed flag when new page data arrives
    processedPageId.value = null
  }, { immediate: true })

  /**
   * Vue lifecycle hook: runs after component DOM updates
   * This fires after ContentRenderer finishes re-rendering with new data
   *
   * IMPORTANT: Add nextTick to ensure all child component DOM updates are committed
   * ContentRenderer might still be updating when onUpdated fires
   */
  onUpdated(() => {
    nextTick(() => {
      processContent()
    })
  })

  /**
   * Also process on initial mount (handles direct page load)
   */
  onMounted(() => {
    // Wait for hydration to complete
    nextTick(() => {
      processContent()
    })
  })
}
