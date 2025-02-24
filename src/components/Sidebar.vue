<script setup>
import { ref } from 'vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'
import ConnectionSetupModal from '@/components/ConnectionSetupModal.vue'
import sidebarStore from '@/stores/sidebar.js'
import Button from 'primevue/button'
import themeStore from '@/stores/theme.js'

const metadataStore = useMetadataStore()
const { connections, tabs } = storeToRefs(metadataStore)
const isConnectionSetupModalOpen = ref(false)

const { isSidebarVisible } = sidebarStore
const connectionOnEdit = ref(null)

function openNewTab(connectionId, connectionName) {
  metadataStore.openNewTab(connectionId, connectionName)
  sidebarStore.onTabOpen()
}

function openConnectionSetup(connection) {
  connectionOnEdit.value = connection
  isConnectionSetupModalOpen.value = true
}
</script>

<template>
  <div
    v-show="isSidebarVisible"
    class="text-3xl sm:text-base relative w-full sm:w-[15rem] sm:block h-max-screen shadow-md"
  >
    <div
      v-show="tabs.length > 0"
      class="absolute right-0 top-0 p-2 cursor-pointer text-gray-400 hover:text-gray-50"
      @click="sidebarStore.hideSidebar()"
    >
      <i class="bi bi-x" />
    </div>
    <div class="p-2 pb-0 text-xs">minderal</div>
    <div class="px-2 text-gray-300 text-xss">v0.35</div>
    <div class="p-2">
      <div class="text-xs uppercase flex items-center mb-2">
        <i class="bi bi-database mr-1" />
        <span class="font-bold">DATABASES</span>
      </div>
      <ul class="my-1">
        <li
          v-for="connection in connections"
          :key="connection.id"
          class="p-2 cursor-pointer rounded-sm hover:bg-(--p-surface-100) dark:hover:bg-(--p-surface-800) relative"
          @click="openNewTab(connection.id, connection.name)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="bi bi-circle-fill text-lg sm:text-base text-(--p-primary-500)" />
              <i v-if="connection.host" class="bi bi-cloud-check-fill text-blue-300" />
              <div>
                {{ connection.name }}
              </div>
            </div>
            <div
              class="rounded-full w-6 text-gray-400 hover:text-(--p-primary-500) flex-center"
              @click.stop="openConnectionSetup(connection)"
            >
              <i class="bi bi-gear" />
            </div>
          </div>
        </li>
        <li
          class="border mt-10 flex-center h-10 rounded-sm border-dashed border-(--p-surface-300) cursor-pointer hover:text-(--p-primary-500) hover:border-(--p-primary-500)"
          @click="isConnectionSetupModalOpen = true"
        >
          <i class="bi bi-plus mr-2" />
          <span class="uppercase">New Database</span>
        </li>
      </ul>
    </div>
    <div class="absolute bottom-[4rem] m-2">
      <Button size="sm" icon="bi bi-brightness-high" @click="themeStore.toggleDarkMode()" />
    </div>
    <ConnectionSetupModal
      :open-modal="isConnectionSetupModalOpen"
      :connection="connectionOnEdit"
      @close="isConnectionSetupModalOpen = false; connectionOnEdit = null"
    />
  </div>
</template>
