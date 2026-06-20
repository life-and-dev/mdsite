<template>
  <div class="search-box">
    <v-text-field
      v-model="searchQuery"
      prepend-inner-icon="mdi-magnify"
      :append-inner-icon="searchQuery ? 'mdi-close' : undefined"
      placeholder="Search pages..."
      variant="outlined"
      density="compact"
      hide-details
      class="search-input"
      @click:append-inner="clearSearch"
      @update:model-value="handleSearch"
    />

    <!-- Search Results -->
    <div v-if="searchQuery && searchResults.length > 0" class="search-results">
      <v-list density="compact">
        <v-tooltip
          v-for="result in searchResults"
          :key="result.path"
          :text="result.description"
          :disabled="!result.description"
          :location="tooltip.location.value"
          :max-width="tooltip.maxWidth"
        >
          <template #activator="{ props: tooltipProps }">
            <v-list-item
              v-bind="tooltipProps"
              class="search-result-item"
              @click="handleSelect(result.path)"
            >
              <v-list-item-title class="result-title">
                {{ result.title }}
              </v-list-item-title>
              <v-list-item-subtitle class="result-breadcrumb">
                {{ result.breadcrumb }}
              </v-list-item-subtitle>
            </v-list-item>
          </template>
        </v-tooltip>
      </v-list>
    </div>

    <!-- No Results -->
    <div v-else-if="searchQuery && searchResults.length === 0" class="no-results">
      <v-list-item>
        <v-list-item-title class="text-center text-caption">
          No results found for "{{ searchQuery }}"
        </v-list-item-title>
      </v-list-item>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SearchableFields } from '~/composables/useSearchRelevance'
import type { SearchIndexEntry } from '~/../../scripts/generate-indices'

interface SearchResult {
  path: string
  title: string
  breadcrumb: string
  description?: string
}

const emit = defineEmits<{
  select: [path: string]
  clear: []
  'search-active': [active: boolean]
}>()

const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])

// Shared tooltip configuration
const tooltip = useTooltipConfig()

// Relevance scoring
const { sortByRelevance } = useSearchRelevance()

// Search index fetcher
const { loadSearchIndex } = useSearchIndex()

/**
 * Check if page matches search query
 */
function pageMatchesQuery(page: SearchIndexEntry, queryLower: string): boolean {
  // Check title, description, excerpt
  const textMatch = (
    page.title.toLowerCase().includes(queryLower) ||
    page.description?.toLowerCase().includes(queryLower) ||
    page.excerpt?.toLowerCase().includes(queryLower)
  )

  // Check keywords array
  const keywordsMatch = page.keywords?.some((keyword: string) =>
    keyword.toLowerCase().includes(queryLower)
  )

  return textMatch || keywordsMatch || false
}

/**
 * Handle search input
 */
async function handleSearch(query: string) {
  if (!query || query.trim() === '') {
    searchResults.value = []
    emit('search-active', false)
    return
  }

  emit('search-active', true)

  try {
    // Load pre-built search index (cached after first load)
    const allPages = await loadSearchIndex()
    const queryLower = query.toLowerCase()

    // Filter pages that match query
    const matchingPages = allPages.filter(page =>
      pageMatchesQuery(page, queryLower)
    )

    // Sort by relevance score (SearchIndexEntry is compatible with SearchableFields)
    const sortedPages = sortByRelevance(matchingPages, query, (page) => page.title)

    // Map top 50 results to SearchResult interface
    searchResults.value = sortedPages
      .slice(0, 50)
      .map((page) => {
        const segments = page.path.split('/').filter(Boolean)
        return {
          path: page.path,
          title: page.title,
          breadcrumb: segments.length > 0
            ? segments.join('/')
            : '/',
          description: page.description
        }
      })
  } catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
  }
}

/**
 * Clear search
 */
function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  emit('clear')
  emit('search-active', false)
}

/**
 * Handle result selection
 */
function handleSelect(path: string) {
  emit('select', path)
  clearSearch()
}
</script>

<style scoped>
.search-box {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0.75rem;
}

.search-results {
  max-height: calc(100vh - 12.5rem);
  overflow-y: auto;
  margin-top: 0.5rem;
  background-color: rgb(var(--v-theme-surface-rail));
  border-radius: 0.5rem;
  border: 1px solid rgb(var(--v-theme-outline-bars));
}

.search-result-item {
  cursor: pointer;
  border-radius: 0.25rem;
  margin: 0.25rem;
}

.search-result-item:hover {
  background-color: rgba(var(--v-theme-on-selectable), 0.04);
}

.result-title {
  font-weight: 500;
  color: rgb(var(--v-theme-on-selectable));
}

.result-breadcrumb {
  font-size: 0.75rem;
  color: rgb(var(--v-theme-on-selectable));
  opacity: 0.6;
}

.no-results {
  margin-top: 0.5rem;
  padding: 1rem;
  color: rgb(var(--v-theme-on-surface-rail));
  opacity: 0.6;
}
</style>
