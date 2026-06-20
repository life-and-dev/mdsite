<template>
  <div class="navigation-tree">
    <!-- Render root's children (skip root itself) -->
    <TreeNode
      v-for="node in rootChildren"
      :key="node.id"
      :node="node"
      :active-path="activePath"
      :expanded-ids="expandedIds"
      :depth="0"
      @toggle="handleToggle"
      @select="handleSelect"
    />
  </div>
</template>

<script setup lang="ts">
import type { TreeNode } from '~/composables/useNavigationTree'

const props = defineProps<{
  tree: TreeNode | null
  activePath: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

// Expanded node IDs
const expandedIds = ref<Set<string>>(new Set())

// Get root's children (skip rendering root itself)
const rootChildren = computed(() => {
  if (!props.tree) return []
  return props.tree.children || []
})

/**
 * Auto-expand path to active node on mount and when activePath changes
 */
watch(() => props.activePath, (newPath) => {
  if (newPath && props.tree) {
    expandPathToActive(newPath)
  }
}, { immediate: true })

/**
 * Expand all ancestors of the active node
 */
function expandPathToActive(path: string) {
  if (!props.tree) return

  // Special case: Homepage (/) - collapse all menus
  if (path === '/') {
    expandedIds.value.clear()
    expandedIds.value = new Set(expandedIds.value)
    return
  }

  const node = findNodeByPath(path, props.tree)
  if (!node) return

  // Walk up the tree and expand all ancestors
  let current = node.parent
  while (current && current.id !== 'root') {
    expandedIds.value.add(current.id)
    current = current.parent
  }

  // Force Vue to detect Set mutations by creating new Set instance
  expandedIds.value = new Set(expandedIds.value)
}

/**
 * Find node by path in tree
 */
function findNodeByPath(path: string, node: TreeNode): TreeNode | null {
  if (node.path === path) return node

  for (const child of node.children || []) {
    const found = findNodeByPath(path, child)
    if (found) return found
  }

  return null
}

/**
 * Handle toggle expand/collapse
 */
function handleToggle(nodeId: string) {
  if (expandedIds.value.has(nodeId)) {
    // Collapse
    expandedIds.value.delete(nodeId)
    // Force Vue to detect Set mutation by creating new Set instance
    expandedIds.value = new Set(expandedIds.value)
  } else {
    // Expand - collapse siblings at same level (Option B behavior)
    const node = findNodeById(nodeId, props.tree)
    if (node && node.parent) {
      // Collapse siblings
      for (const sibling of node.parent.children || []) {
        if (sibling.id !== nodeId && sibling.id !== node.id) {
          expandedIds.value.delete(sibling.id)
        }
      }
    }

    // Expand this node
    expandedIds.value.add(nodeId)
    // Force Vue to detect Set mutation by creating new Set instance
    expandedIds.value = new Set(expandedIds.value)
  }
}

/**
 * Find node by ID
 */
function findNodeById(id: string, node: TreeNode | null): TreeNode | null {
  if (!node) return null
  if (node.id === id) return node

  for (const child of node.children || []) {
    const found = findNodeById(id, child)
    if (found) return found
  }

  return null
}

/**
 * Handle node selection
 */
function handleSelect(path: string) {
  emit('select', path)
}

/**
 * Scroll active node into view
 */
function scrollActiveIntoView() {
  nextTick(() => {
    const activeElement = document.querySelector('.tree-node.is-active')
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  })
}

// Scroll active node into view when path changes
watch(() => props.activePath, () => {
  scrollActiveIntoView()
})

// Initial scroll on mount
onMounted(() => {
  scrollActiveIntoView()
})
</script>

<style scoped>
.navigation-tree {
  width: 100%;
  padding: 8px 4px;
}
</style>
