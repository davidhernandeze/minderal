<template>
  <div class="bg-gray-800 w-full h-10 overflow-hidden flex">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="p-2 rounded-t w-32 flex justify-between cursor-pointer mr-0.5"
      :class="{ 'bg-gray-700': tab.isOpen, 'bg-gray-900': !tab.isOpen}"
      @click="metadataStore.openTab(index)"
    >
      <span class="truncate text-xs">{{ tab.name }}</span>
      <div
        class="h-3 w-3 rounded-full flex-center hover:bg-gray-600"
        @click.stop="metadataStore.closeTab(index)"
      >
        <i
          class="fa-solid h-2 fa-times"
        />
      </div>
    </div>
    <div
      class="ml-3"
      @click="useSidebar.showSidebar()"
    >
      connections
    </div>
  </div>
</template>
<script setup>
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'
import useSidebar from '@/composables/useSidebar.js'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)
</script>
