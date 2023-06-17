<template>
  <div class="h-screen w-screen bg-gray-900 text-gray-100">
    <div class="flex">
      <Sidebar />
      <div class="w-full bg-gray-800 p-2 h-screen">
        <div class="flex flex-col h-full">
          <Tabs class="mt-1" />
          <div class="flex-1 overflow-y-auto bg-gray-700">
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
</style>
