<template>
  <div class="tree-node-wrapper">
    <!-- Separator rendering -->
    <v-divider
      v-if="node.isSeparator"
      :style="{ marginLeft: `${depth * 1.25}rem`, marginTop: '0.5rem', marginBottom: '0.5rem', marginRight: '0.5rem' }"
    />

    <!-- Header rendering (non-clickable section label) -->
    <div
      v-else-if="node.isHeader"
      class="tree-header"
      :style="{ paddingLeft: `${depth * 1.25 + 1.75}rem` }"
    >
      <span class="header-title">{{ node.title }}</span>
    </div>

    <div
      v-else
      class="tree-node"
      :class="{
        'is-active': isActive,
        'is-parent': hasChildren,
        'is-expanded': isExpanded
      }"
      :style="{ paddingLeft: `${depth * 1.25}rem` }"
    >
      <!-- Expand/collapse chevron for parent nodes -->
      <v-btn
        v-if="hasChildren"
        icon
        size="x-small"
        variant="text"
        class="chevron-button"
        @click="handleToggle"
      >
        <v-icon
          :icon="isExpanded ? 'mdi-chevron-down' : 'mdi-chevron-right'"
          size="16"
        />
      </v-btn>

      <!-- Active indicator dot -->
      <span v-else class="leaf-indicator" />

      <!-- Node title with optional tooltip -->
      <v-tooltip
        v-if="node.description"
        :text="node.description"
        :location="tooltip.location.value"
        :max-width="tooltip.maxWidth"
      >
        <template #activator="{ props: tooltipProps }">
          <span
            v-bind="tooltipProps"
            class="node-title"
            :class="{ 'is-parent-title': hasChildren }"
            @click="handleSelect"
          >
            {{ node.title }}
            <v-icon
              v-if="node.isExternal"
              icon="mdi-open-in-new"
              size="14"
              class="external-icon"
            />
          </span>
        </template>
      </v-tooltip>
      <span
        v-else
        class="node-title"
        :class="{ 'is-parent-title': hasChildren }"
        @click="handleSelect"
      >
        {{ node.title }}
        <v-icon
          v-if="node.isExternal"
          icon="mdi-open-in-new"
          size="14"
          class="external-icon"
        />
      </span>
    </div>

    <!-- Recursively render children -->
    <div v-if="isExpanded && hasChildren" class="tree-children">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :active-path="activePath"
        :expanded-ids="expandedIds"
        :depth="depth + 1"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TreeNode as TreeNodeType } from '~/composables/useNavigationTree'

const props = defineProps<{
  node: TreeNodeType
  activePath: string
  expandedIds: Set<string>
  depth: number
}>()

const emit = defineEmits<{
  toggle: [id: string]
  select: [path: string]
}>()

const hasChildren = computed(() => {
  return props.node.children && props.node.children.length > 0
})

const isExpanded = computed(() => props.expandedIds.has(props.node.id))
const isActive = computed(() => {
  // Only primary menu items can be highlighted
  // Aliases (custom titled links) should never be highlighted
  return props.node.isPrimary === true && props.node.path === props.activePath
})

// Shared tooltip configuration
const tooltip = useTooltipConfig()

function handleToggle() {
  emit('toggle', props.node.id)
}

function handleSelect() {
  // Handle external URLs differently
  if (props.node.isExternal && props.node.externalUrl) {
    window.open(props.node.externalUrl, '_blank', 'noopener,noreferrer')
    return
  }

  // For parent nodes: toggle expansion AND navigate
  if (hasChildren.value) {
    emit('toggle', props.node.id)
  }

  // Navigate to the page
  emit('select', props.node.path)
}
</script>

<style scoped>
.tree-node-wrapper {
  width: 100%;
}

.tree-node {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
  border-radius: 0.25rem;
  margin: 0.125rem 0;
}

.tree-node:hover {
  background-color: rgba(var(--v-theme-on-selectable), 0.04);
}

.tree-node.is-active {
  background-color: rgb(var(--v-theme-selected));
  color: rgb(var(--v-theme-on-selected));
}

.tree-header {
  display: flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.75rem 0.5rem 0.25rem 0.5rem;
  margin-top: 0.5rem;
}

.header-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface-rail));
  text-transform: uppercase;
  letter-spacing: 0.05rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chevron-button {
  margin-right: 0.25rem;
  flex-shrink: 0;
}

.tree-node.is-active :deep(.chevron-button .v-icon) {
  color: rgb(var(--v-theme-on-selected));
}

.leaf-indicator {
  width: 1.5rem;
  height: 1.5rem;
  margin-right: 0.25rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leaf-indicator::before {
  content: '';
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background-color: transparent;
  transition: background-color 0.15s ease;
}

.tree-node.is-active .leaf-indicator::before {
  background-color: rgb(var(--v-theme-on-selected));
}

.node-title {
  flex: 1;
  font-size: 0.875rem;
  font-weight: 400;
  color: rgb(var(--v-theme-on-selectable));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s ease;
}

.node-title.is-parent-title {
  font-weight: 500;
}

.tree-node.is-active .node-title {
  font-weight: 600;
  color: rgb(var(--v-theme-on-selected));
}

.tree-children {
  width: 100%;
}

.external-icon {
  margin-left: 0.25rem;
  opacity: 0.6;
  vertical-align: middle;
}

/* Touch target size for mobile */
@media (max-width: 599px) {
  .tree-node {
    min-height: 3rem;
  }
}
</style>
