<script setup>
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'
import sidebarStore from '@/stores/sidebar.js'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="w-full flex">
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
      v-show="!isSidebarVisible"
      class="p-2 rounded-t w-8 flex-center cursor-pointer mr-0.5"
      @click="sidebarStore.showSidebar()"
    >
      <i class="fa-light h-3 fa-add" />
    </div>
  </div>
</template>
