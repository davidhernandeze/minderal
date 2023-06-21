<template>
  <div
    v-show="isSidebarVisible"
    class="relative w-full sm:w-48 sm:block h-screen h-max-screen bg-gray-700 shadow-md"
  >
    <div @click="useSidebar.hideSidebar()" class="absolute right-0 top-0 p-1">
      {{ '<<' }}
    </div>
    <div class="p-2">
      minderal 2.0
    </div>
    <div class="p-2">
      <div class="text-xss uppercase flex items-center mb-2">
        <i class="fa-light fa-database mr-1" />
        CONNECTIONS
      </div>
      <ul class="my-1">
        <li
          v-for="connection in connections"
          :key="connection.id"
          class="p-2 cursor-pointer rounded bg-gray-600 my-2 border border-gray-600 hover:border-gray-500 relative flex items-center justify-between"
          @click="metadataStore.openNewTab(connection.id, connection.name)"
        >
          <div class="flex items-center">
            <i class="fa-solid fa-circle h-2 text-green-400 mr-2" />
            <div class="text-xs">
              {{ connection.name }}
            </div>
          </div>
          <div
            class="rounded-full h-6 w-6 text-gray-400 hover:text-gray-50 flex-center"
            @click.stop="console.log('asda')"
          >
            <i class="fa-light h-3 fa-gear" />
          </div>
        </li>
        <li
          class="border flex-center h-10 rounded border-dashed border-gray-400 cursor-pointer hover:text-green-300 hover:border-green-300"
          @click="isConnectionSetupModalOpen = true"
        >
          <i class="fa-solid h-2 fa-add mr-2" />
          <span class="uppercase text-xss">New Connection</span>
        </li>
      </ul>
    </div>
    <ConnectionSetupModal
      :open-modal="isConnectionSetupModalOpen"
      @close="isConnectionSetupModalOpen = false"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'
import ConnectionSetupModal from '@/components/ConnectionSetupModal.vue'
import useSidebar from '@/composables/useSidebar.js'

const metadataStore = useMetadataStore()
const { connections } = storeToRefs(metadataStore)
const isConnectionSetupModalOpen = ref(false)

const { isSidebarVisible } = useSidebar
</script>
