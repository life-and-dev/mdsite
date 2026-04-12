<template>
  <nav class="breadcrumb-nav" aria-label="Breadcrumb">
    <ol class="breadcrumb-list">
      <li
        v-for="(item, index) in breadcrumbs"
        :key="item.path"
        class="breadcrumb-item"
      >
        <v-tooltip
          v-if="item.title === '...'"
          text="Navigate up to parent section"
          location="bottom"
        >
          <template #activator="{ props: tooltipProps }">
            <a
              v-bind="tooltipProps"
              class="breadcrumb-link"
              :class="{ 'is-ellipsis': item.title === '...' }"
              @click.prevent="router.push(item.path)"
            >
              {{ item.title }}
            </a>
          </template>
        </v-tooltip>
        <a
          v-else
          class="breadcrumb-link"
          :class="{ 'is-current': index === breadcrumbs.length - 1 }"
          @click.prevent="handleClick(item, index)"
        >
          {{ item.title }}
        </a>
        <span
          v-if="index < breadcrumbs.length - 1"
          class="breadcrumb-separator"
          aria-hidden="true"
        >
          >
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import type { BreadcrumbItem } from '~/composables/useBreadcrumbs'

const props = defineProps<{
  breadcrumbs: BreadcrumbItem[]
}>()

const router = useRouter()

function handleClick(item: BreadcrumbItem, index: number) {
  // Don't navigate if it's the current page (last item)
  if (index !== props.breadcrumbs.length - 1) {
    router.push(item.path)
  }
}
</script>

<style scoped>
.breadcrumb-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.breadcrumb-list {
  display: flex;
  align-items: center;
  list-style: none;
  margin: 0;
  padding: 0;
  flex-wrap: nowrap;
  overflow: hidden;
  max-width: 100%;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  flex-shrink: 1;
  min-width: 0;
}

.breadcrumb-link {
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.15s ease, color 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.875rem;
  font-weight: 500;
}

.breadcrumb-link:hover {
  background-color: rgba(var(--v-theme-on-selectable), 0.04);
  color: rgb(var(--v-theme-primary));
}

.breadcrumb-link.is-current {
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  cursor: default;
  pointer-events: none;
}

.breadcrumb-link.is-ellipsis {
  font-weight: 600;
  min-width: auto;
  flex-shrink: 0;
}

.breadcrumb-separator {
  margin: 0 4px;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.4;
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* Responsive adjustments */
@media (max-width: 599px) {
  .breadcrumb-link {
    font-size: 0.75rem;
    padding: 2px 6px;
  }

  .breadcrumb-separator {
    margin: 0 2px;
  }
}
</style>
