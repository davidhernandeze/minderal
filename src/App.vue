<script setup>
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { onBeforeMount } from 'vue'
import WorkspaceManager from '@/components/WorkspaceManager.vue'
import sidebarStore from '@/stores/sidebar.js'
import { storeToRefs } from 'pinia'
import DebugStore from '@/stores/DebugStore.js'
import Mindbar from '@/components/Mindbar.vue'

const { isSidebarVisible } = sidebarStore

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)
const { offline } = DebugStore
const path = location.pathname

onBeforeMount(async () => {
  await metadataStore.fetchMetadata()
})
</script>
<template>
  <div v-if="path !== '/mindbar'" class="max-h-screen h-screen bg-gray-800 text-gray-100 flex">
    <Sidebar class="flex-none" />
    <div :class="[isSidebarVisible ? 'hidden sm:block' : 'block']" class="w-full pl-2 pr-0 pb-0">
      <div v-if="offline" class="p-1 text-xs text-center bg-red-500/50">Offline</div>
      <div class="flex flex-col h-full">
        <Tabs class="pt-1" />
        <WorkspaceManager v-show="tabs.length > 0" class="flex-1 overflow-y-auto" />
      </div>
    </div>
    <div class="text-gray-300 text-xs fixed bottom-0 m-2">v0.30</div>
  </div>
  <Mindbar v-else />
</template>

<style>
html {
  font-family: 'Selawk', serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  border-radius: 0.375rem;
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawk.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawkl.ttf') format('truetype');
  font-weight: 300;
  font-style: normal;
}

@font-face {
  font-family: 'Selawk';
  src: url('assets/fonts/selawkb.ttf') format('truetype');
  font-weight: 700; /* Bold weight */
  font-style: normal; /* Normal style */
}

@font-face {
  font-family: 'Nunito Regular';
  src: url('assets/fonts/Nunito-Regular.ttf');
}

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #1f2937 #2a384c;
}

/* Chrome, Edge, and Safari */
*::-webkit-scrollbar {
  width: 5px;
}

*::-webkit-scrollbar-track {
  background: #2c394a;
  border-radius: 5px;
}

*::-webkit-scrollbar-thumb {
  background-color: #1f2937;
}
</style>
