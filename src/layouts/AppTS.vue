<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import WorkspaceManager from '@/components/workspace/WorkspaceManager.vue'
import sidebarStore from '@/stores/sidebar.js'
import ConfirmDialog from 'primevue/confirmdialog'
import SpaceBackground from '@/components/SpaceBackground.vue'
import themeStore from '@/stores/theme.js'

const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="max-h-screen h-screen flex">
    <SpaceBackground :enabled="themeStore.isDarkTheme" />
    <ConfirmDialog />
    <Sidebar class="flex-none z-10" />
    <div
      :class="[isSidebarVisible ? 'hidden sm:block' : 'block']"
      class="w-full pl-2 pr-0 pb-0 z-10"
    >
      <div class="flex flex-col h-full">
        <Tabs class="pt-1" />
        <WorkspaceManager class="flex-1 overflow-y-auto" />
      </div>
    </div>
  </div>
</template>
