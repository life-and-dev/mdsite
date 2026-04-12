<template>
  <article>
    <div v-if="pending" class="text-center py-8">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
    </div>
    <div v-else-if="!page">
      <v-alert type="error">Home page not found</v-alert>
    </div>
    <div v-else>
      <div class="content-body">
        <ContentRenderer :value="page" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
// Query home page content using Nuxt Content v3 API
// server: true = Only query during SSR/prerendering, never on client
// This prevents 3.5MB database download - client uses prerendered HTML
const { data: page, pending } = await useAsyncData(
  'content-home',
  () => queryCollection('content').path('/').first(),
  { server: true } // true = SSR/prerender only
)

const siteConfig = useSiteConfig()
const title = page.value?.title || 'Home'
const description = page.value?.description || ''

useHead(() => ({
  title,
  htmlAttrs: { lang: 'en' },
  meta: [
    { name: 'description', content: description },
    { name: 'keywords', content: page.value?.keywords?.join(', ') || '' },
    { name: 'robots', content: 'index, follow' },
    { name: 'theme-color', content: siteConfig.themeColorLight, media: '(prefers-color-scheme: light)' },
    { name: 'theme-color', content: siteConfig.themeColorDark, media: '(prefers-color-scheme: dark)' },
    // Open Graph
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: siteConfig.siteCanonical },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: '/icon-512.png' }
  ],
  link: [
    ...(siteConfig.siteCanonical ? [{ rel: 'canonical', href: siteConfig.siteCanonical }] : [])
  ]
}))

// Post-process content: like Bible tooltips + TOC generation
useContentPostProcessing(page)
</script>
