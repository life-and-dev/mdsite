<template>
  <div class="prose-table-wrapper">
    <!-- Hidden original table for SSR and parsing -->
    <div ref="tableContainerRef" class="original-table" :style="{ display: isClient && headers.length > 0 ? 'none' : 'block' }">
      <table>
        <slot />
      </table>
    </div>

    <!-- v-data-table rendered client-side -->
    <v-data-table
      v-if="isClient && headers.length > 0"
      :headers="headers"
      :items="items"
      :items-per-page="-1"
      :mobile-breakpoint="600"
      class="my-4"
      density="comfortable"
      hide-default-footer
    >
      <!-- Custom cell rendering to support HTML content -->
      <template v-for="header in headers" :key="header.key" #[`item.${header.key}`]="{ value }">
        <!-- eslint-disable vue/no-v-html -->
        <span v-html="value" />
        <!-- eslint-enable vue/no-v-html -->
      </template>
    </v-data-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTableParser } from '~/composables/useTableParser'
import type { TableHeader, TableItem } from '~/types/table'

/**
 * Custom ProseTable component for Nuxt Content
 *
 * Renders markdown tables as Vuetify v-data-table components with:
 * - Material Design 3 styling
 * - Sorting capabilities (click column headers)
 * - Responsive mobile layout (cards on small screens)
 * - All rows displayed (no pagination)
 *
 * SSR Strategy:
 * - Server renders original <table> for SEO and accessibility
 * - Client parses table and renders v-data-table on mount
 * - Original table hidden once v-data-table is ready
 */

const tableContainerRef = ref<HTMLDivElement | null>(null)
const headers = ref<TableHeader[]>([])
const items = ref<TableItem[]>([])
const isClient = ref(false)

const { parseTable } = useTableParser()

onMounted(() => {
  isClient.value = true

  // Wait for next tick to ensure slot content is fully rendered
  nextTick(() => {
    if (!tableContainerRef.value) return

    // Find the actual <table> element in the rendered slot
    const tableElement = tableContainerRef.value.querySelector('table')

    if (!tableElement) {
      console.warn('[ProseTable] No <table> element found in slot content')
      return
    }

    // Parse the table structure
    const parsed = parseTable(tableElement)

    if (parsed.headers.length === 0) {
      console.warn('[ProseTable] No headers found in table. Falling back to original table rendering.')
      return
    }

    // Update reactive data
    headers.value = parsed.headers
    items.value = parsed.items
  })
})
</script>

<style scoped>
.prose-table-wrapper {
  margin: 1rem 0;
}

/* Style original table with basic formatting when v-data-table isn't available */
.original-table table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.original-table th,
.original-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid rgb(var(--v-theme-outline));
}

.original-table th {
  font-weight: 500;
  background-color: rgb(var(--v-theme-surface-container));
  color: rgb(var(--v-theme-on-surface-variant));
}

.original-table tr:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

/* Style lists and line breaks within table cells */
.prose-table-wrapper :deep(.v-data-table) ul,
.prose-table-wrapper :deep(.v-data-table) ol {
  margin: 0.25rem 0;
  padding-left: 1.25rem;
  list-style-position: outside;
}

.prose-table-wrapper :deep(.v-data-table) ul {
  list-style-type: disc;
}

.prose-table-wrapper :deep(.v-data-table) ol {
  list-style-type: decimal;
}

.prose-table-wrapper :deep(.v-data-table) li {
  margin: 0.25rem 0;
  line-height: 1.5;
}

.prose-table-wrapper :deep(.v-data-table) br {
  display: block;
  content: "";
  margin-top: 0.375rem;
}
</style>
