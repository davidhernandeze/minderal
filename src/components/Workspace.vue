<template>
  <div class="h-full flex flex-col bg-gray-700 p-4">
    <div
      v-if="currentDocument"
      class="fixed top-0 right-0 text-green-200 text-xss"
    >
      {{ currentDocument._id }}
    </div>
    <div class="grow-0 bg-gray-700 z-10 mb-2">
      <div class="flex items-center">
        <DocumentRoute
          :route="currentRoute"
          @navigate="navigate"
        />
      </div>
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="border-none bg-transparent p-1 pl-0 focus:outline-none outline-none w-full rounded focus:ring-0"
        type="text"
        placeholder="Search..."
      >
    </div>
    <div class="flex-1 overflow-y-auto pb-36">
      <ExpandedWidget
        v-if="connectionDone"
        @navigate="navigate"
      />
    </div>
    <div
      v-show="showMainInput"
      class="fixed right-0 bottom-0 p-3 pb-0 w-full flex justify-center"
    >
      <div
        :class="{ 'sm:pl-48': isSidebarVisible }"
        class="w-full max-w-3xl"
      >
        <div
          class="flex-center p-1 py-2 flex-wrap bg-gray-700 shadow-lg rounded"
        >
          <div class="w-full sm:w-auto py-2">
            <button
              class="px-4 py-2 rounded mr-2 hover:bg-gray-600"
              @click="isTypesModalOpen = true"
            >
              <span v-if="iconRerender">
                <i
                  :class="selectedWidget.icon"
                  class="h-3 mr-2"
                />
              </span>
              {{ selectedWidget.label }}
            </button>
          </div>
          <div class="flex-1 p-2">
            <input
              ref="mainInput"
              v-model="inputValue"
              class="w-full text-gray-50 rounded text-md p-2 bg-gray-800"
              type="text"
              @keyup.enter="createDocument"
            >
          </div>
          <div class="flex-center p-2">
            <GenericButton
              class="bg-indigo-600 hover:bg-indigo-500"
              @click="createDocument"
            >
              Create
            </GenericButton>
          </div>
        </div>
      </div>
      <SelectWidgetModal
        :open-modal="isTypesModalOpen"
        @close="isTypesModalOpen = false"
        @select="selectWidget"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, provide, ref, watch } from 'vue'
import DocumentRoute from '@/components/DocumentRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import { getWidgetList, widgets } from '@/enums/widgets.js'
import ExpandedWidget from '@/components/ExpandedWidget.vue'
import SelectWidgetModal from '@/components/SelectWidgetModal.vue'
import GenericButton from '@/components/GenericButton.vue'
import { useDatabase } from '@/composables/useDatabase.js'
import sidebarStore from '@/stores/sidebar.js'

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  documentId: {
    type: String,
    default: ''
  }
})

const emits = defineEmits(['navigate'])

const database = useDatabase(props.connectionId, props.documentId)
const { currentRoute, connectionDone, currentDocument } = database

const mainInput = ref(null)
const inputValue = ref('')

const searchInput = ref(null)
const searchQuery = ref('')

const keys = useMagicKeys()
const shiftCtrlA = keys['Ctrl+K']

const isTypesModalOpen = ref(false)
const selectedWidget = ref(getWidgetList()[0])
const iconRerender = ref(true)

const { isSidebarVisible } = sidebarStore

provide('database', database)
provide('searchQuery', searchQuery)

watch(shiftCtrlA, (v) => {
  if (!v) return
  searchInput.value.focus()
})

const showMainInput = computed(() => {
  let type = 'folder'
  if (currentDocument.value) {
    type = currentDocument.value.type
  }
  return widgets[type].showMainInput
})

async function createDocument () {
  await database.createDocument(inputValue.value, selectedWidget.value)
  inputValue.value = ''
}

async function selectWidget (widget) {
  selectedWidget.value = widget
  isTypesModalOpen.value = false
  iconRerender.value = false
  await nextTick()
  iconRerender.value = true
}

async function navigate (documentId) {
  await database.setCurrentDocument(documentId)
  emits('navigate', documentId)
}

onBeforeUnmount(async () => {
  await database.closeConnection()
})
</script>
