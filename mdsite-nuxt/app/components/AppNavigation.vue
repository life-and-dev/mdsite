<template>
  <div class="navigation-sidebar" ref="sidebarContainer">
    <!-- Search Box (sticky at top) - only on desktop -->
    <SearchBox
      v-if="showSearch"
      class="search-sticky"
      @select="handleSearchSelect"
      @clear="showTree = true"
      @search-active="handleSearchActive"
    />

    <v-divider v-if="showSearch" />

    <!-- Navigation Tree or Search Results -->
    <div v-if="showTree" class="tree-container" ref="treeContainer">
      <NavigationTree
        v-if="navigationTree"
        :tree="navigationTree"
        :active-path="route.path"
        @select="handleNavSelect"
      />
      <div v-else class="loading-state">
        <v-progress-circular indeterminate size="32" />
      </div>
    </div>

    <!-- Fade gradient for overflow -->
    <div v-if="showFade" class="fade-gradient" />
  </div>
</template>

<script setup lang="ts">
import { useNavigationTree } from '~/composables/useNavigationTree'

const props = defineProps<{
  showSearch?: boolean
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const route = useRoute()

// Navigation tree state
const { tree: navigationTree, loadTree } = useNavigationTree()

// UI state
const showTree = ref(true)
const showFade = ref(false)
const sidebarContainer = ref<HTMLElement>()
const treeContainer = ref<HTMLElement>()

// Load navigation tree on mount
onMounted(async () => {
  await loadTree()
  checkOverflow()
})

/**
 * Handle search selection
 */
function handleSearchSelect(path: string) {
  showTree.value = true
  emit('select', path)
  navigateTo(path)
}

/**
 * Handle search active state
 */
function handleSearchActive(active: boolean) {
  showTree.value = !active
}

/**
 * Handle navigation selection
 */
function handleNavSelect(path: string) {
  emit('select', path)
  navigateTo(path)
}

/**
 * Check if content overflows and show fade gradient
 */
function checkOverflow() {
  if (!treeContainer.value) return

  const hasOverflow = treeContainer.value.scrollHeight > treeContainer.value.clientHeight
  showFade.value = hasOverflow
}

// Set up ResizeObserver to detect overflow
onMounted(() => {
  if (!treeContainer.value) return

  const resizeObserver = new ResizeObserver(() => {
    checkOverflow()
  })

  resizeObserver.observe(treeContainer.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})
</script>

<style scoped>
.navigation-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background-color: rgb(var(--v-theme-surface-rail));
}

.search-sticky {
  flex-shrink: 0;
}

.tree-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
}

/* Hide scrollbar but keep functionality */
.tree-container::-webkit-scrollbar {
  display: none;
}

.tree-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.fade-gradient {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to bottom,
    transparent,
    rgb(var(--v-theme-surface-rail))
  );
  pointer-events: none;
  z-index: 10;
}
</style>
