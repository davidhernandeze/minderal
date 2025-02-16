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
import Modal from '@/components/Modal.vue'
import WidgetForm from '@/components/WidgetForm.vue'

const props = defineProps({
  connectionId: {
    type: String,
    required: true,
  },
  docId: {
    type: String,
    default: '',
  },
})

const emits = defineEmits(['navigate', 'change-tab-label'])

const workspace = useWorkspace({ connectionId: props.connectionId, docId: props.docId })
const { connectionDone, currentDoc, connectDB, setCurrentDoc, currentRoute } = workspace

onBeforeMount(async () => {
  await connectDB()
})

watch(
  () => props.docId,
  async (value) => {
    await setCurrentDoc(value)
    emits('change-tab-label', currentDoc.value?.name)
  },
)

const mainInput = ref(null)
const inputValue = ref('')

const searchInput = ref(null)
const searchQuery = ref('')

const keys = useMagicKeys()
const shiftCtrlA = keys['Ctrl+K']

const isTypesModalOpen = ref(false)
const selectedWidget = ref(getWidgetList()[0])
const iconRerender = ref(true)

const widgetFormOpen = ref(false)

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

async function createDoc() {
  const content = selectedWidget.value.createWithContent
    ? inputValue.value
    : selectedWidget.value.default
  const name = selectedWidget.value.createWithContent ? '' : inputValue.value
  await workspace.createDoc({
    name,
    content,
    widget: selectedWidget.value.index,
  })
  inputValue.value = ''
}

async function selectWidget(widget) {
  selectedWidget.value = widget
  isTypesModalOpen.value = false
  iconRerender.value = false
  await nextTick()
  iconRerender.value = true

  if (widget.formComponent) {
    widgetFormOpen.value = true
  }
}

onBeforeUnmount(async () => {
  await workspace.close()
})
</script>

<template>
  <div class="h-full flex flex-col bg-gray-700 p-6 pr-0 pb-[5rem] overflow-visible">
    <div class="grow-0 bg-gray-700 z-10 mb-2">
      <div class="flex items-center">
        <DocRoute :route="currentRoute" @navigate="(docId) => $emit('navigate', docId)" />
      </div>
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="border-none bg-transparent p-1 pl-0 focus:outline-hidden outline-hidden w-full rounded-sm focus:ring-0 text-lg my-4"
        type="text"
        placeholder="Search..."
      />
    </div>
    <div class="flex-1 overflow-y-auto">
      <WidgetExpanded v-if="connectionDone" :doc="currentDoc" />
    </div>
    <button class="hidden" @click="workspace.migrateDatabase()">migrate</button>
    <div
      v-show="showMainInput"
      class="fixed right-0 bottom-0 px-0 p-3 pt-0 pb-0 w-full flex justify-center"
    >
      <div :class="{ 'sm:pl-48': isSidebarVisible }" class="w-full max-w-3xl">
        <div
          class="flex-center p-1 py-2 flex-wrap bg-gray-700 shadow-lg rounded-sm border border-gray-600 border-b-0"
        >
          <div class="w-full sm:w-auto py-2">
            <button
              class="px-4 py-2 rounded-sm mr-2 hover:bg-gray-600"
              @click="isTypesModalOpen = true"
            >
              <span v-if="iconRerender">
                <i :class="selectedWidget.icon" class="h-3 mr-2" />
              </span>
              {{ selectedWidget.label }}
            </button>
          </div>
          <div class="flex-1 p-2">
            <input
              ref="mainInput"
              v-model="inputValue"
              class="w-full text-gray-50 rounded-sm text-md p-2 bg-gray-800"
              type="text"
              @keyup.enter="createDoc"
            />
          </div>
          <div class="flex-center p-2">
            <GenericButton class="bg-indigo-600 hover:bg-indigo-500" @click="createDoc">
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
      <Modal v-model:is-open="widgetFormOpen">
        <template #body>
          <WidgetForm :widget="selectedWidget" @save="widgetFormOpen = false" />
        </template>
      </Modal>
    </div>
  </div>
</template>
