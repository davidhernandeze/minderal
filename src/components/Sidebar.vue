<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'
import ConnectionSetupModal from '@/components/ConnectionSetupModal.vue'
import sidebarStore from '@/stores/sidebar.js'
import Button from 'primevue/button'
import Tree from 'primevue/tree'
import themeStore from '@/stores/theme.js'
import useApplication from '@/composables/useApplication'
import { Connection } from '@/domain/Connection'
import { Database } from '@/domain/Database'

const { app, connections } = useApplication()

const nodes = computed(() => {
  return connections.value.map((connection: Connection) => ({
    key: connection.id,
    label: connection.name,
    children: connection.getDatabaseList().map((db: Database) => ({
      key: db.name,
      label: db.name,
      type: 'db',
      children: [],
      online: db.online,
      object: db
    }))
  }))
})

const expandedKeys = ref({})
const expandAll = () => {
  for (let node of nodes.value) {
    expandNode(node)
  }

  expandedKeys.value = { ...expandedKeys.value }
}

const collapseAll = () => {
  expandedKeys.value = {}
}

const expandNode = (node) => {
  if (node.children && node.children.length) {
    expandedKeys.value[node.key] = true

    for (let child of node.children) {
      expandNode(child)
    }
  }
}

expandAll()

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

const isConnectionSetupModalOpen = ref(false)
const { isSidebarVisible } = sidebarStore

const connectionOnEdit = ref(null)
function openNewTab(db: Database) {
  app.openNewTab(db)
  sidebarStore.onTabOpen()
}
function openConnectionSetup(connection) {
  connectionOnEdit.value = connection
  isConnectionSetupModalOpen.value = true
}
function close() {
  isConnectionSetupModalOpen.value = false
  connectionOnEdit.value = null
}

onMounted(() => {
  expandAll()
})
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
    <div class="px-2 text-gray-300 text-xss">v0.47ts</div>
    <div class="p-2">
      <div class="text-xs uppercase flex items-center mb-2">
        <i class="bi bi-database mr-1" />
        <span class="font-bold">DATABASES</span>
      </div>
      <ul class="my-1">
        <Tree v-model:expanded-keys="expandedKeys" :value="nodes" class="w-full !p-0">
          <template #default="slotProps">
            <b>{{ slotProps.node.label }}</b>
          </template>
          <template #db="slotProps">
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-2">
                <i
                  v-if="slotProps.node.online"
                  class="bi bi-circle-fill text-lg sm:text-base text-(--p-primary-500)"
                />
                <i v-else class="bi bi-circle-fill text-lg sm:text-base text-(--p-gray-500)" />
                <i v-if="slotProps.node.host" class="bi bi-cloud-check-fill text-blue-300" />
                <div>
                  {{ slotProps.node.label }}
                </div>
              </div>
              <div class="flex gap-6 sm:gap-2">
                <button
                  class="rounded-full w-6 text-gray-400 hover:text-(--p-primary-500) flex-center cursor-pointer"
                  @click.stop="openConnectionSetup(slotProps.node.key)"
                >
                  <i class="bi bi-gear" />
                </button>
                <button
                  class="rounded-full w-6 text-gray-400 hover:text-(--p-primary-500) flex-center cursor-pointer"
                  @click="openNewTab(slotProps.node.object)"
                >
                  <i class="bi bi-box-arrow-up-right" />
                </button>
              </div>
            </div>
          </template>
        </Tree>
        <li
          class="border mt-10 flex-center py-4 rounded-sm border-dashed border-(--p-surface-300) cursor-pointer hover:text-(--p-primary-500) hover:border-(--p-primary-500)"
          @click="isConnectionSetupModalOpen = true"
        >
          <i class="bi bi-plus mr-2" />
          <span class="uppercase">New Database</span>
        </li>
      </ul>
    </div>
    <div class="absolute bottom-[4rem] m-2">
      <Button size="small" icon="bi bi-brightness-high" @click="themeStore.toggleDarkMode()" />
    </div>
    <ConnectionSetupModal
      :open-modal="isConnectionSetupModalOpen"
      :connection="connectionOnEdit"
      @close="close"
    />
  </div>
</template>

<style>
.p-tree-node-leaf > .p-tree-node-content .p-tree-node-toggle-button {
  display: none;
}

.p-tree-node-content {
  display: block !important;
}
</style>
