<template>
  <div class="mermaid-container">
    <div v-if="!svg" class="mermaid-loading">
      <v-progress-circular indeterminate size="24"></v-progress-circular>
      <span>Rendering diagram...</span>
    </div>
    <div v-html="svg" ref="container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const svg = ref('')
const container = ref<HTMLElement | null>(null)

const renderDiagram = async () => {
  if (process.server) return

  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        primaryColor: '#6200ee',
        primaryTextColor: '#fff',
        primaryBorderColor: '#6200ee',
        lineColor: '#6200ee',
        secondaryColor: '#03dac6',
        tertiaryColor: '#f5f5f5'
      },
      securityLevel: 'loose',
      fontFamily: 'Noto Sans, sans-serif'
    })

    const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`
    const { svg: renderedSvg } = await mermaid.render(id, props.code)
    svg.value = renderedSvg
  } catch (error) {
    console.error('Mermaid rendering failed:', error)
    svg.value = `<div class="error">Failed to render diagram: ${error}</div>`
  }
}

onMounted(() => {
  renderDiagram()
})

watch(() => props.code, () => {
  renderDiagram()
})
</script>

<style scoped>
.mermaid-container {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
  padding: 1rem;
  background-color: rgb(var(--v-theme-surface));
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.05);
}

.mermaid-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-style: italic;
}

:deep(svg) {
  max-width: 100%;
  height: auto;
}

.error {
  color: var(--v-theme-error);
  padding: 1rem;
  font-family: monospace;
}

@media print {
  .mermaid-container {
    background: white !important;
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    margin: 1rem 0 !important;
    padding: 0 !important;
  }
}
</style>
