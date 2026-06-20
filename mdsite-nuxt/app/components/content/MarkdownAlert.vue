<template>
  <div :class="['markdown-alert', `markdown-alert-${type}`]">
    <p class="markdown-alert-title">
      <v-icon :icon="icon" size="small" class="mr-2" />
      {{ title }}
    </p>
    <div class="alert-content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  type: 'note' | 'tip' | 'important' | 'warning' | 'caution'
}>()

const iconMap = {
  note: 'mdi-information',
  tip: 'mdi-lightbulb',
  important: 'mdi-alert-circle',
  warning: 'mdi-alert',
  caution: 'mdi-alert-octagon'
}

const titleMap = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution'
}

const icon = computed(() => iconMap[props.type] || iconMap.note)
const title = computed(() => titleMap[props.type] || titleMap.note)
</script>

<style scoped>
.alert-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
