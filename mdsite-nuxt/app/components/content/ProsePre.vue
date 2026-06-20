<template>
  <Mermaid v-if="language === 'mermaid'" :code="code" />
  <pre v-else :class="$attrs.class"><slot /></pre>
</template>

<script setup lang="ts">
const props = defineProps({
  code: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: null
  },
  filename: {
    type: String,
    default: null
  },
  highlights: {
    type: Array,
    default: () => []
  },
  meta: {
    type: String,
    default: null
  }
})
</script>

<style scoped>
pre {
  border-radius: 1rem;
  position: relative;
  padding: 1rem;
  overflow-x: auto;
  background-color: #ddd;
  border: 2px solid rgb(var(--v-theme-outline));
  border-radius: 1rem !important;
}

@media print {
  pre {
    background-color: white !important;
    border-radius: 1rem !important;
    border: 2px solid #ccc !important;
  }
}
</style>
