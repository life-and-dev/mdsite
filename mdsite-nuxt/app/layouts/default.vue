<template>
  <div class="layout-wrapper">
    <!-- App Bar -->
    <AppBar
      :sidebars-visible="mdAndUp && sidebarsVisible"
      @toggle-menu="handleToggleMenu"
    />

    <!-- Desktop Layout (md and up) -->
    <div v-if="mdAndUp" class="desktop-wrapper">
      <div class="desktop-layout">
        <!-- Left Sidebar (Navigation) -->
        <v-navigation-drawer
          v-model="sidebarsVisible"
          :permanent="!isPrinting"
          absolute
          location="left"
          width="320"
          :touchless="true"
          :scrim="false"
          :disableRouteWatcher="true"
          class="desktop-drawer-left"
        >
          <AppNavigation
            :show-search="true"
            @select="handleNavSelect"
          />
        </v-navigation-drawer>

        <!-- Center Content Column (flexible) -->
        <v-main class="content-area">
          <v-container :fluid="isPrinting" :class="{ 'print-force-full': isPrinting }">
            <div ref="desktopContentContainer">
              <slot />
            </div>
          </v-container>
        </v-main>

        <!-- Right Sidebar (Table of Contents) -->
        <v-navigation-drawer
          v-if="shouldShowTOC"
          v-model="sidebarsVisible"
          :permanent="!isPrinting"
          absolute
          location="right"
          width="320"
          :touchless="true"
          :scrim="false"
          :disableRouteWatcher="true"
          class="desktop-drawer-right"
        >
          <AppTableOfContents
            :toc-items="tocItems"
            :active-id="activeHeadingId"
          />
        </v-navigation-drawer>
      </div>
    </div>

    <!-- Mobile Layout (sm and below) -->
    <div v-else class="mobile-layout">
      <!-- Mobile Drawer -->
      <v-navigation-drawer
        v-model="drawerOpen"
        temporary
        location="left"
        width="320"
      >
        <div class="drawer-content">
          <!-- Search Box -->
          <SearchBox
            @select="handleMobileSelection"
          />

          <v-divider class="my-2" />

          <!-- "On This Page" Section (mobile only) -->
          <v-expansion-panels v-if="shouldShowTOC" flat>
            <v-expansion-panel color="surface-rail">
              <v-expansion-panel-title class="toc-panel-title">
                On This Page
              </v-expansion-panel-title>
              <v-expansion-panel-text class="bg-surface-rail">
                <AppTableOfContents
                  :toc-items="tocItems"
                  :active-id="activeHeadingId"
                  :show-header="false"
                  @item-click="handleMobileSelection"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-divider v-if="shouldShowTOC" class="my-2" />

          <!-- Navigation Tree -->
          <AppNavigation
            :show-search="false"
            @select="handleMobileSelection"
          />
        </div>
      </v-navigation-drawer>

      <!-- Full-width Content -->
      <v-main class="content-area-mobile">
        <v-container>
          <div ref="mobileContentContainer">
            <slot />
          </div>
        </v-container>
      </v-main>
    </div>

    <!-- Footer Bar (always visible on all layouts) -->
    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { useTableOfContents } from '~/composables/useTableOfContents'

const { mdAndUp } = useDisplay()
const route = useRoute()

// Table of Contents state
const desktopContentContainer = ref<HTMLElement>()
const mobileContentContainer = ref<HTMLElement>()
const { tocItems, activeId: activeHeadingId, shouldShowTOC, generateTOC } = useTableOfContents()

// Provide TOC generation function to child pages
provide('generateTOC', () => {
  const container = mdAndUp.value ? desktopContentContainer.value : mobileContentContainer.value
  if (container) {
    generateTOC(container)
  }
})

// Sidebar state - initialize based on screen size
const sidebarsVisible = ref(mdAndUp.value)
const drawerOpen = ref(false)

// Update sidebars visibility when screen size changes
watch(mdAndUp, (newValue) => {
  sidebarsVisible.value = newValue
  if (!newValue) {
    drawerOpen.value = false
  }
})

// Print handling - close sidebars to allow content to expand natively
// Print handling
const isPrinting = ref(false)
let previousSidebarState = true

const handlePrint = async () => {
  previousSidebarState = sidebarsVisible.value
  
  // 1. Enter print mode
  isPrinting.value = true
  sidebarsVisible.value = false
  
  // 2. Wait for Vue to update the DOM (including style recalculations)
  await nextTick()
  // Small delay to ensure layout shifts have completed visually for the browser's print capture
  // 500ms to accommodate the 0.3s sidebar transition
  await new Promise(resolve => setTimeout(resolve, 500))

  // 3. Print
  window.print()

  // 4. Cleanup after print dialog closes
  isPrinting.value = false
  sidebarsVisible.value = previousSidebarState
}

// Provide to children (like AppBar)
provide('triggerPrint', handlePrint)

// Also listen for Ctrl+P (native browser print)
// Note: This might still have a race condition on some browsers since we can't "pause" the event.
// The button click approach (triggerPrint) is preferred.
const onBeforePrint = () => {
  if (!isPrinting.value) { // Only run if not already triggered by our helper
    previousSidebarState = sidebarsVisible.value
    isPrinting.value = true
    sidebarsVisible.value = false
  }
}

const onAfterPrint = () => {
  // Only restore if we weren't triggered by the helper (which handles its own restore)
  // Or just safe to always restore if we are in print mode
  if (isPrinting.value) {
    isPrinting.value = false
    sidebarsVisible.value = previousSidebarState
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('beforeprint', onBeforePrint)
    window.removeEventListener('afterprint', onAfterPrint)
  }
})

/**
 * Handle toggle menu (hamburger click)
 */
function handleToggleMenu() {
  if (mdAndUp.value) {
    // Desktop: toggle both sidebars
    sidebarsVisible.value = !sidebarsVisible.value
  } else {
    // Mobile: toggle drawer
    drawerOpen.value = !drawerOpen.value
  }
}

/**
 * Handle navigation selection (desktop)
 */
function handleNavSelect(path: string) {
  // Don't auto-close on desktop
  navigateTo(path)
}

/**
 * Handle any selection in mobile drawer (navigation, search, or TOC)
 * Auto-closes drawer after selection
 */
function handleMobileSelection(path?: string) {
  drawerOpen.value = false
  if (path) {
    navigateTo(path)
  }
}

/**
 * NOTE: We do NOT clear TOC on route change here
 * The page component's useContentPostProcessing handles clearing and regenerating
 * Clearing here causes a race condition where we clear AFTER the page has already generated TOC
 */
</script>

<style>
/* Global: Prevent horizontal scroll on body */
body {
  overflow-x: hidden;
  max-width: 100vw;
}

/* CSS Variables - must be unscoped */
:root {
  --app-bar-height: 56px;
  --footer-height: 56px;
  --sidebar-transition: 0.3s ease;
}

/* Print styles - hide navigation elements */
/* Print styles - hide navigation elements */
@media print {
  .v-navigation-drawer,
  .v-app-bar,
  .v-footer {
    display: none !important;
  }

  /* Reset layout constraints - Force block to kill flexbox gaps */
  .desktop-layout,
  .v-application,
  .v-main,
  .content-area {
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    /* Force reset Vuetify layout variables to ensure no space is reserved */
    --v-layout-left: 0px !important;
    --v-layout-right: 0px !important;
    --v-layout-top: 0px !important;
    --v-layout-bottom: 0px !important;
  }

  /* Ensure container takes full width - High Specificity to override scoped styles */
  .v-application .v-container,
  .v-container.print-force-full,
  .v-container {
    max-width: none !important;
    width: 100% !important;
    padding: 0 16px !important;
    margin: 0 !important;
    flex: 0 0 100% !important;
  }
}
</style>

<style scoped>

/* Desktop Wrapper - clips overflow for slide animations */
.desktop-wrapper {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
  overflow-y: visible;
  position: relative;
}

/* Desktop Layout - full height flex container */
.desktop-layout {
  display: flex;
  min-height: 100vh;
  width: 100%;
  position: relative;
}

/* Desktop drawers - fixed positioning with independent scrolling */
.desktop-layout :deep(.v-navigation-drawer.desktop-drawer-left),
.desktop-layout :deep(.v-navigation-drawer.desktop-drawer-right) {
  position: fixed !important;
  top: 0 !important;
  bottom: 0 !important;
  left: auto !important;
  right: auto !important;
  height: 100vh !important;
  z-index: 1100 !important;
  overflow-y: auto;
}

.desktop-layout :deep(.v-navigation-drawer.desktop-drawer-left) {
  left: 0 !important;
}

.desktop-layout :deep(.v-navigation-drawer.desktop-drawer-right) {
  right: 0 !important;
}

/* Content area - Vuetify handles spacing automatically via --v-layout-* vars */
.content-area {
  flex: 1;
  min-width: 0;
  /* Remove custom margins - Vuetify calculates based on drawer width */
  margin: 0 !important;
}

.content-area-mobile {
  width: 100%;
  overflow-y: auto;
}

.drawer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.toc-panel-title {
  font-weight: 600;
  font-size: 0.875rem;
}

/* Ensure proper spacing for container - Screen only */
@media screen {
  :deep(.v-container) {
    max-width: 1200px;
  }
}
</style>
