<template>
  <div
    class="toc-item"
    :class="{ 'is-active': isActive }"
    :style="{ paddingLeft: `${item.level * 16}px` }"
    @click="handleClick"
  >
    <span class="toc-text">{{ item.text }}</span>
  </div>
</template>

<script setup lang="ts">
import type { TocItem as TocItemType } from '~/composables/useTableOfContents'

const props = defineProps<{
  item: TocItemType
  isActive: boolean
}>()

const emit = defineEmits<{
  click: [id: string]
}>()

function handleClick() {
  emit('click', props.item.id)
}
</script>

<style scoped>
.toc-item {
  min-height: 36px;
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s ease, padding-left 0.15s ease;
  margin: 2px 0;
}

.toc-item:hover {
  background-color: rgba(var(--v-theme-on-selectable), 0.04);
}

.toc-item.is-active {
  background-color: rgb(var(--v-theme-selected));
}

.toc-text {
  font-size: 0.813rem;
  line-height: 1.4;
  color: rgb(var(--v-theme-on-selectable));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s ease;
}

.toc-item:hover .toc-text {
  color: rgb(var(--v-theme-on-selectable));
  text-decoration: underline;
}

.toc-item.is-active .toc-text {
  color: rgb(var(--v-theme-on-selected));
  font-weight: 600;
}

/* Touch target size for mobile */
@media (max-width: 599px) {
  .toc-item {
    min-height: 44px;
  }
}
</style>
