<script setup>
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'
import sidebarStore from '@/stores/sidebar.js'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="w-full flex text-white">
    <div
      v-for="(tab, index) in tabs"
      :key="tab.id"
      class="p-2 rounded-t w-32 flex justify-between cursor-pointer mr-0.5"
      :class="{ 'bg-gray-700': tab.isOpen, 'bg-gray-900': !tab.isOpen}"
      @click="metadataStore.openTab(index)"
    >
      <div>
        <div class="flex items-center">
          <i class="mr-2" :class="tab.icon" />
          <p class="truncate text-sm">{{ tab.label || 'home' }}</p>
        </div>
        <p class="truncate text-xss font-light tracking-wider">@{{ tab.name }}</p>
      </div>
      <div
        class="h-[1.2rem] w-[1.2rem] rounded-full flex-center hover:bg-gray-600"
        @click.stop="metadataStore.closeTab(index)"
      >
        <i
          class="bi bi-x"
        />
      </div>
    </div>
    <div
      v-show="!isSidebarVisible"
      class="p-2 rounded-t w-8 flex-center cursor-pointer mr-0.5"
      @click="sidebarStore.showSidebar()"
    >
      <i class="bi bi-plus" />
    </div>
  </div>
</template>
