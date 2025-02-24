<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import WorkspaceManager from '@/components/WorkspaceManager.vue'
import sidebarStore from '@/stores/sidebar.js'
import DebugStore from '@/stores/DebugStore.js'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'

const metadataStore = inject('metadataStore')
const { tabs } = storeToRefs(metadataStore)

const { offline } = DebugStore
const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="max-h-screen h-screen flex">
    <Sidebar class="flex-none" />
    <div :class="[isSidebarVisible ? 'hidden sm:block' : 'block']" class="w-full pl-2 pr-0 pb-0">
      <div v-if="offline" class="p-1 text-xs text-center bg-red-500/50">Offline</div>
      <div class="flex flex-col h-full">
        <Tabs class="pt-1" />
        <WorkspaceManager v-show="tabs.length > 0" class="flex-1 overflow-y-auto" />
      </div>
    </div>
  </div>
</template>
