<script setup lang="ts">
import Workspace from '@/components/Workspace.vue'
import ConnectionMenubar from '@/components/ConnectionMenubar.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { Application, Tab } from '@/domain'
import SpaceBackground from '@/components/SpaceBackground.vue'
import themeStore from '@/stores/theme.js'
import { inject, onMounted, onUnmounted } from 'vue'
import Tabs from '@/components/Tabs.vue'

onMounted(() => {
  document.documentElement.classList.add('v4-layout')
})

onUnmounted(() => {
  document.documentElement.classList.remove('v4-layout')
})

const app = inject<Application>('app')
const tabs = useReactiveObjectProp<Application, Tab[]>(app, (a) => a.getTabs(), 'tabs:changed')
const activeTabId = useReactiveObjectProp<Application, string | null>(
  app,
  (a) => a.activeTabId,
  'tabs:changed'
)
</script>

<template>
  <div class="max-h-screen h-screen flex flex-col relative">
    <SpaceBackground :enabled="themeStore.isDarkTheme.value" />

    <div class="relative z-20 flex items-center p-1">
      <ConnectionMenubar />
      <div class="flex-1 overflow-x-auto">
        <Tabs />
      </div>
    </div>

    <!-- Workspaces (one per tab, only active shown) -->
    <div class="relative z-10 flex-1 min-h-0">
      <Workspace
        v-for="tab in tabs"
        v-show="tab.id === activeTabId"
        :key="tab.id"
        :workspace="tab.workspace"
        class="h-full"
      />
    </div>
  </div>
</template>

<style>
html {
  font-size: 20px;
}

@media (min-width: 768px) {
  html {
    font-size: 22px;
  }
}

@media (min-width: 1280px) {
  html {
    font-size: 28px;
  }
}
</style>
