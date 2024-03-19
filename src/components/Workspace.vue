<script setup>
import { computed, nextTick, onBeforeMount, onBeforeUnmount, provide, ref, watch } from 'vue'
import DocRoute from '@/components/DocRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import { getWidgetList, widgets } from '@/enums/widgets.js'
import WidgetExpanded from '@/components/WidgetExpanded.vue'
import SelectWidgetModal from '@/components/SelectWidgetModal.vue'
import GenericButton from '@/components/GenericButton.vue'
import { useWorkspace } from '@/composables/useWorkspace.js'
import sidebarStore from '@/stores/sidebar.js'

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  },
  docId: {
    type: String,
    default: ''
  }
})

const emits = defineEmits(['navigate'])

const workspace = useWorkspace({ connectionId: props.connectionId, docId: props.docId })
const { connectionDone, currentDoc, connectDB, setCurrentDoc, currentRoute } = workspace

onBeforeMount(async () => {
  await connectDB()
})

watch(() => props.docId, async (value) => {
  await setCurrentDoc(value)
})

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

provide('workspace', workspace)
provide('searchQuery', searchQuery)
provide('navigate', (docId) => emits('navigate', docId))

watch(shiftCtrlA, (v) => {
  if (!v) return
  searchInput.value.focus()
})

const showMainInput = computed(() => {
  let type = 'folder'
  if (workspace.currentDoc.value) {
    type = workspace.currentDoc.value.widget
  }
  return widgets[type]?.showMainInput || false
})

async function createDoc () {
  await workspace.createDoc({
    name: inputValue.value,
    content: selectedWidget.value.default,
    widget: selectedWidget.value.index
  })
  inputValue.value = ''
}

async function selectWidget (widget) {
  selectedWidget.value = widget
  isTypesModalOpen.value = false
  iconRerender.value = false
  await nextTick()
  iconRerender.value = true
}

onBeforeUnmount(async () => {
  await workspace.close()
})
</script>

<template>
  <div class="h-full flex flex-col bg-gray-700 p-4">
    <div class="grow-0 bg-gray-700 z-10 mb-2">
      <div class="flex items-center">
        <DocRoute
          :route="currentRoute"
          @navigate="docId => $emit('navigate', docId)"
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
    <div
      class="flex-1 overflow-y-auto"
    >
      <WidgetExpanded v-if="connectionDone" :doc="currentDoc"/>
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
              @keyup.enter="createDoc"
            >
          </div>
          <div class="flex-center p-2">
            <GenericButton
              class="bg-indigo-600 hover:bg-indigo-500"
              @click="createDoc"
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
