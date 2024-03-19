<script setup>
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { onBeforeMount } from 'vue'
import WorkspaceManager from '@/components/WorkspaceManager.vue'
import sidebarStore from '@/stores/sidebar.js'
import { storeToRefs } from 'pinia'

const { isSidebarVisible } = sidebarStore

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

onBeforeMount(async () => {
  await metadataStore.fetchMetadata()
})

</script>
<template>
  <div
    v-if="true"
    class="max-h-screen h-screen bg-gray-800 text-gray-100 flex"
  >
    <Sidebar class="flex-none" />
    <div
      :class="[isSidebarVisible ? 'hidden sm:block' : 'block']"
      class="w-full pl-2 pr-0 pb-0"
    >
      <Tabs class="h-[5vh] pt-1" />
      <WorkspaceManager
        v-show="tabs.length > 0"
        class="h-[95vh]"
      />
    </div>
    <div class="text-gray-600 text-xs fixed bottom-0 m-2">
      v0.2
    </div>
  </div>
</template>

<style>

html {
    background-color: green;
    font-family: 'Selawk Light', serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

@font-face {
    font-family: 'Selawk Light';
    src: url('assets/fonts/selawk.ttf');
}
@font-face {
    font-family: 'Nunito Regular';
    src: url('assets/fonts/Nunito-Regular.ttf');
}

/* Firefox */
* {
    scrollbar-width: thin;
    scrollbar-color: #1F2937 #2a384c;
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
    background-color: #1F2937;
}
</style>
