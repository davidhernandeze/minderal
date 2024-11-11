<script setup>
import { ref } from 'vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
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

<template>
  <div
    v-show="isSidebarVisible"
    class="relative w-full sm:w-[15rem] sm:block h-max-screen bg-gray-700 shadow-md"
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
        DATABASES
      </div>
      <ul class="my-1">
        <li
          v-for="connection in connections"
          :key="connection.id"
          class="p-2 cursor-pointer rounded bg-gray-600 my-2 border border-gray-600 hover:border-gray-500 relative"
          @click="openNewTab(connection.id, connection.name)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-circle h-3 text-green-400" />
              <i
                v-if="connection.host"
                class="fa-solid fa-cloud-arrow-up h-4 text-blue-300"
              />
              <div class="text-sm">
                {{ connection.name }}
              </div>
            </div>
            <div
              class="rounded-full w-6 text-gray-400 hover:text-gray-50 flex-center"
              @click.stop="openConnectionSetup(connection)"
            >
              <i class="fa-light h-4 fa-gear" />
            </div>
          </div>
        </li>
        <li
          class="border flex-center h-10 rounded border-dashed border-gray-400 cursor-pointer hover:text-green-300 hover:border-green-300"
          @click="isConnectionSetupModalOpen = true"
        >
          <i class="fa-solid h-3 fa-add mr-2" />
          <span class="uppercase text-xss">New Database</span>
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
