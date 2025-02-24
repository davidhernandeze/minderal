<script setup>
import { computed, nextTick, onBeforeMount, onBeforeUnmount, provide, ref, watch } from 'vue'
import DocRoute from '@/components/DocRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import { getWidgetList, getWidgetProps, widgets } from '@/enums/widgets.js'
import WidgetExpanded from '@/components/WidgetExpanded.vue'
import SelectWidgetModal from '@/components/SelectWidgetModal.vue'
import { useWorkspace } from '@/composables/useWorkspace.js'
import sidebarStore from '@/stores/sidebar.js'
import WidgetForm from '@/components/WidgetForm.vue'
import ProgressSpinner from 'primevue/progressspinner'
import Panel from 'primevue/panel'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'

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
const { connectionDone, currentDoc, connectDB, setCurrentDoc, currentRoute, isLoading } = workspace

onBeforeMount(async () => {
  await connectDB()
})

watch(
  () => props.docId,
  async (value) => {
    await setCurrentDoc(value)
    const icon = getWidgetProps(currentDoc.value?.widget || 'folder')?.icon
    emits('change-tab-label', { label: currentDoc.value?.name, icon })
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
  <Panel
    pt:root:class="h-full !rounded-none !border-none flex flex-col"
    pt:content-container:class="h-full min-h-0 flex-1 flex flex-col"
    pt:content:class="relative h-full flex flex-col !pb-0 p-6 pr-0 overflow-visible !rounded-t-none"
  >
    <div class="absolute right-[1rem] top-[1rem] z-99">
      <ProgressSpinner
        v-show="isLoading"
        style="width: 30px; height: 30px"
        strokeWidth="8"
        fill="transparent"
        animationDuration="0.6s"
        aria-label="Custom ProgressSpinner"
      />
    </div>
    <div class="grow-0 z-10 mb-2">
      <div class="flex items-center">
        <DocRoute :route="currentRoute" @navigate="(docId) => $emit('navigate', docId)" />
      </div>
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="border-none bg-transparent p-1 pl-0 focus:outline-hidden outline-hidden w-full rounded-sm focus:ring-0 text-2xl mb-2"
        type="text"
        placeholder="Search..."
      />
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto pb-[10rem]">
      <WidgetExpanded v-if="connectionDone" :doc="currentDoc" />
    </div>
    <button class="hidden" @click="workspace.migrateDatabase()">migrate</button>
    <div
      v-show="showMainInput"
      class="fixed right-0 bottom-0 px-0 p-3 pt-0 pb-0 w-full flex justify-center"
    >
      <div :class="{ 'sm:pl-48': isSidebarVisible }" class="w-full max-w-3xl">
        <div
          class="flex-center p-1 py-2 flex-wrap shadow-lg rounded-md bg-[var(--p-surface-50)] dark:bg-[var(--p-surface-800)]"
        >
          <div class="w-full sm:w-auto py-2">
            <button
              class="px-4 py-2 rounded-sm mr-2 hover:bg-(--p-primary-500) cursor-pointer"
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
              class="w-full rounded-sm text-md p-2 dark:bg-(--p-surface-900)"
              type="text"
              @keyup.enter="createDoc"
            />
          </div>
          <div class="flex-center p-2">
            <Button label="Add" @click="createDoc" />
          </div>
        </div>
      </div>
      <SelectWidgetModal
        :open-modal="isTypesModalOpen"
        @close="isTypesModalOpen = false"
        @select="selectWidget"
      />
      <Dialog header="Create widget" modal v-model:visible="widgetFormOpen" style="width: 40rem">
        <WidgetForm :widget="selectedWidget" @save="widgetFormOpen = false" />
      </Dialog>
    </div>
  </Panel>
</template>
