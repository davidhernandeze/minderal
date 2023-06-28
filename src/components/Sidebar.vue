<template>
  <div
    v-show="isSidebarVisible"
    class="relative w-full sm:w-48 sm:block h-max-screen bg-gray-700 shadow-md"
  >
    <div
      v-show="tabs.length > 0"
      class="absolute right-0 top-0 p-2 cursor-pointer text-gray-400 hover:text-gray-50 text-xs"
      @click="sidebarStore.hideSidebar()"
    >
      <i class="fa-light fa-times" />
    </div>
    <div class="p-2 text-xs">
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
          @click="openNewTab(connection.id, connection.name)"
        >
          <div class="flex items-center">
            <i class="fa-solid fa-circle h-2 text-green-400 mr-2" />
            <div class="text-xs">
              {{ connection.name }}
            </div>
          </div>
          <div
            class="rounded-full h-6 w-6 text-gray-400 hover:text-gray-50 flex-center"
            @click.stop="openConnectionSetup(connection)"
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
      :connection="connectionOnEdit"
      @close="isConnectionSetupModalOpen = false; connectionOnEdit = null"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'
import ConnectionSetupModal from '@/components/ConnectionSetupModal.vue'
import sidebarStore from '@/stores/sidebar.js'

const metadataStore = useMetadataStore()
const { connections, tabs } = storeToRefs(metadataStore)
const isConnectionSetupModalOpen = ref(false)

const { isSidebarVisible } = sidebarStore
const connectionOnEdit = ref(null)

function openNewTab (connectionId, connectionName) {
  metadataStore.openNewTab(connectionId, connectionName)
  sidebarStore.onTabOpen()
}

function openConnectionSetup (connection) {
  connectionOnEdit.value = connection
  isConnectionSetupModalOpen.value = true
}
</script>
