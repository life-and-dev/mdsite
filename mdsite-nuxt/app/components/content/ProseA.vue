<template>
  <NuxtLink :to="cleanHref" :target="target">
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
/**
 * Custom ProseA component for Nuxt Content
 *
 * Strips .md extensions from internal links for web routes.
 * This allows markdown files to have .md extensions (for IDE preview)
 * while web routes remain clean (without .md).
 *
 * Example:
 * - Markdown: [link](/docs/history.md)
 * - Rendered: <a href="/docs/history">link</a>
 */

interface ProseAProps {
  href?: string
  target?: string
}

const props = defineProps<ProseAProps>()

// Strip /content/{domain}/ prefix and .md extension from href for web routes
// External URLs (http/https) are passed through unchanged
const cleanHref = computed(() => {
  if (!props.href) return props.href

  // Don't modify external URLs
  if (props.href.startsWith('http://') || props.href.startsWith('https://')) {
    return props.href
  }

  // Don't modify anchor-only links
  if (props.href.startsWith('#')) {
    return props.href
  }

  let cleaned = props.href

  // Strip /content/{domain}/ prefix from absolute paths (for web routing)
  // Example: /content/example/docs/history.md → /docs/history.md
  // This allows IDE to navigate with full paths while web uses clean URLs
  cleaned = cleaned.replace(/^\/content\/[^/]+/, '')

  // Strip .md extension from internal links (before any fragment/query)
  // Example: /docs/history.md → /docs/history
  // Example: /docs/history.md#section → /docs/history#section
  // Example: ../parent.md → ../parent
  cleaned = cleaned.replace(/\.md(#|\?|$)/, '$1')

  return cleaned
})
</script>
