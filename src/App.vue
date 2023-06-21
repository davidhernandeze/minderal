<template>
  <div class="h-screen w-screen bg-gray-900 text-gray-100">
    <div class="flex">
      <Sidebar />
      <div
        :class="[isSidebarVisible ? 'hidden sm:block' : 'block']"
        class="w-full bg-gray-800 p-2 pr-0 h-screen"
      >
        <div class="flex flex-col h-full">
          <Tabs class="mt-1" />
          <div
            v-show="tabs.length > 0"
            class="flex-1 overflow-y-auto bg-gray-700 rounded"
          >
            <WorkspaceManager />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { onBeforeMount } from 'vue'
import WorkspaceManager from '@/components/WorkspaceManager.vue'
import useSidebar from '@/composables/useSidebar.js'
import { storeToRefs } from 'pinia'

const { isSidebarVisible } = useSidebar

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

const { fetchMetadata } = useMetadataStore()

onBeforeMount(async () => {
  await fetchMetadata()
})

</script>

<style>

html {
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
