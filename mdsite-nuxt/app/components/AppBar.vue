<template>
  <v-app-bar
    height="56"
    :class="['app-bar', { 'sidebars-visible': sidebarsVisible }]"
    flat
  >
    <!-- Hamburger menu (always visible) -->
    <v-tooltip text="Toggle menu" location="bottom">
      <template v-slot:activator="{ props }">
        <v-app-bar-nav-icon
          v-bind="props"
          icon="mdi-menu"
          @click="$emit('toggle-menu')"
        />
      </template>
    </v-tooltip>

    <!-- Breadcrumb navigation -->
    <BreadcrumbNav :breadcrumbs="breadcrumbs" class="flex-grow-1" />

    <!-- Action buttons (right-aligned) -->

    <v-tooltip text="Toggle theme" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-brightness-6" @click="toggleTheme" />
      </template>
    </v-tooltip>

    <v-tooltip text="Print page" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn v-bind="props" icon="mdi-printer" @click="handlePrint" />
      </template>
    </v-tooltip>

    <v-tooltip v-if="editUrl" text="Edit on GitHub" location="bottom">
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          icon="mdi-pencil"
          :href="editUrl"
          target="_blank"
          rel="noopener noreferrer"
        />
      </template>
    </v-tooltip>
    
  </v-app-bar>
</template>

<script setup lang="ts">
import { generateBreadcrumbs } from '~/composables/useBreadcrumbs'
import type { BreadcrumbItem } from '~/composables/useBreadcrumbs'
import { useSourceEdit } from '~/composables/useSourceEdit';

const props = defineProps<{
  sidebarsVisible?: boolean
}>()

const emit = defineEmits<{
  'toggle-menu': []
}>()

const route = useRoute()
const { toggleTheme } = useAppTheme()
const { getEditUrl } = useSourceEdit()

// Generate breadcrumbs for current route
const breadcrumbs = ref<BreadcrumbItem[]>([])

async function loadBreadcrumbs() {
  breadcrumbs.value = await generateBreadcrumbs(route.path)
}

// Generate GitHub edit URL
const editUrl = computed(() => getEditUrl())

// Watch for route changes
watch(() => route.path, () => {
  loadBreadcrumbs()
}, { immediate: true })

const triggerPrint = inject('triggerPrint', () => {
  // Fallback if not provided
  window.print()
})

const handlePrint = () => {
  triggerPrint()
}
</script>

<style scoped>
.app-bar {
  z-index: 1000 !important;
}

/* Desktop: Add margins to prevent sidebar overlap */
@media (min-width: 960px) {
  .app-bar :deep(.v-toolbar__content) {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    margin-left: 0;
    margin-right: 0;
    max-width: 100vw;
    transition: margin-left 0.3s ease, margin-right 0.3s ease, max-width 0.3s ease;
  }

  /* When sidebars are visible, add margins */
  .app-bar.sidebars-visible :deep(.v-toolbar__content) {
    margin-left: 320px;
    margin-right: 320px;
    max-width: calc(100vw - 320px - 320px);
  }

  /* Adjust left icon margin when sidebars are visible */
  .app-bar.sidebars-visible :deep(.v-app-bar-nav-icon) {
    margin-left: 0.5rem;
  }

  /* Adjust right icon margins when sidebars are visible */
  .app-bar.sidebars-visible :deep(.v-btn:last-child) {
    margin-right: 0.5rem;
  }
}

/* Ensure breadcrumbs don't overlap with buttons */
.flex-grow-1 {
  flex-grow: 1;
  min-width: 0;
}

/* Print: Hide AppBar */
@media print {
  .app-bar {
    display: none !important;
  }
}
</style>
