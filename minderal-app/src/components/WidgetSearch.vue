<script setup>
import useFolder from '@/composables/useFolder.js'
import { old_useWorkspace } from '@/composables/old_useWorkspace.js'
import searchStatus from '@/stores/searchStatus.js'
import { computed, nextTick, onMounted, provide, ref, watch } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'
import Button from 'primevue/button'
import { onKeyStroke, useDocumentVisibility } from '@vueuse/core'
import icon from '@/assets/logo.svg'
import ProgressSpinner from 'primevue/progressspinner'
import InputText from 'primevue/inputtext'
import Panel from 'primevue/panel'
import useIndexLoop from '@/composables/useIndexLoop.js'
import DocRoute from '@/components/DocRoute.vue'
import WidgetPreview from '@/components/WidgetPreview.vue'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import InvisibleTextInput from '@/components/generic/InvisibleTextInput.vue'

const props = defineProps({
  connectionId: {
    type: String,
    required: true
  }
})

const visibility = useDocumentVisibility()
watch(visibility, (current, previous) => {
  if (current === 'visible' && previous === 'hidden') {
    document.getElementById('mainInput').focus()
  }
})

const workspace = old_useWorkspace({ connectionId: props.connectionId })
const { connectDB, currentRoute, setCurrentDoc, currentDoc } = workspace

onMounted(async () => {
  await connectDB()
  await nextTick()
  document.getElementById('mainInput')?.focus()
})

const { searching, query } = searchStatus
const newDocumentContent = ref('')
const { filteredDocuments } = useFolder(workspace.childDocs, query)
const { currentIndex, increment, decrement } = useIndexLoop(filteredDocuments)
const selectedDoc = computed(() => filteredDocuments.value?.[currentIndex.value] || {})
provide('navigate', setCurrentDoc)
provide('workspace', workspace)

onKeyStroke(['Backspace'], (e) => {
  if (query.value.length > 0) return
  e.preventDefault()
  navigateBack()
})

function tabClickAction() {
  if (!selectedDoc.value._id) {
    document.getElementById('newDocumentContent')?.focus()
    return
  }
  increment()
  document.getElementById('mainInput').focus()
}

function tabShiftClickAction() {
  decrement()
  document.getElementById('mainInput').focus()
}

async function navigateToDoc(docId) {
  query.value = ''
  await setCurrentDoc(docId)
  document.getElementById('mainInput').focus()
}

async function navigateToSelectedDoc() {
  if (!selectedDoc.value._id) return
  const toClipboard = getWidgetProps(selectedDoc.value.widget)?.toClipboard
  if (toClipboard) {
    await copySelectedDocToClipboard()
    await invoke('hide')
    return
  }
  await navigateToDoc(selectedDoc.value._id)
}

async function navigateBack() {
  if (currentRoute.value.length === 0) return
  await navigateToDoc(currentDoc.value.parent_id)
}

async function copySelectedDocToClipboard() {
  const widgetProps = getWidgetProps(selectedDoc.value.widget)
  await writeText(widgetProps.toClipboard(selectedDoc.value))
}

async function createDocument() {
  await workspace.createDoc({
    name: query.value,
    widget: 'text',
    content: newDocumentContent.value.trim(),
    parent_id: currentDoc.value?._id || ''
  })
  newDocumentContent.value = ''
  document.getElementById('mainInput')?.focus()
}
</script>
<template>
  <div
    class="flex h-full"
    @keydown.prevent.tab.exact="tabClickAction"
    @keydown.prevent.shift.tab="tabShiftClickAction"
    @keydown.prevent.right="tabClickAction"
    @keydown.prevent.left="tabShiftClickAction"
    @keyup.prevent.enter.exact="navigateToSelectedDoc"
    @keyup.prevent.shift.enter="createDocument"
  >
    <div class="flex-1">
      <DocRoute class="text-2xl" :route="currentRoute" @navigate="(id) => setCurrentDoc(id)" />
      <div class="flex items-center">
        <ProgressSpinner
          v-if="searching"
          style="width: 1.5rem; height: 1.5rem"
          stroke-width="8"
          fill="transparent"
          animation-duration="0.6s"
          aria-label="Custom ProgressSpinner"
        />
        <img v-else :src="icon" alt="logo" class="w-[1.5rem] h-[1.5rem]" />
        <InputText
          id="mainInput"
          v-model="query"
          v-focustrap="selectedDoc._id"
          :disabled="!connectionId"
          class="w-full ml-2"
          type="text"
          autocorrect="off"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Search..."
        />
      </div>
      <div class="mt-4 h-[7.2rem] overflow-y-scroll overflow-x-hidden flex flex-wrap gap-2">
        <div v-for="(doc, index) in filteredDocuments" :key="doc._id">
          <Button
            pt:root:class="max-w-[10rem]"
            pt:label:class="truncate"
            type="button"
            size="small"
            raised
            :outlined="index !== currentIndex"
            :label="doc.name"
            :icon="getWidgetProps(doc.widget).icon"
            @focus="currentIndex = index"
            @pointerenter="currentIndex = index"
            @click="navigateToSelectedDoc"
          />
        </div>
      </div>
    </div>
    <div class="w-[18rem] p-4">
      <div v-if="selectedDoc._id" class="h-[12rem] flex flex-col">
        <div class="h-[1.5rem] w-full my-1">
          <div v-if="getWidgetProps(selectedDoc.widget).toClipboard">
            <i class="bi bi-copy cursor-pointer" @click="copySelectedDocToClipboard" />
            <span class="ml-2 text-xss">Press enter to copy widget content and hide mindbar.</span>
          </div>
        </div>
        <WidgetPreview
          :key="selectedDoc._rev"
          class="flex-1"
          :single="true"
          :hide-menu="true"
          :doc="selectedDoc"
        />
      </div>
      <div v-else-if="query.length > 0 && connectionId" class="h-[12rem] flex flex-col">
        <div class="h-[1.5rem] w-full my-1">
          <span class="text-xss">Press <span class="text-green-500">Shift+Enter</span> to create a new text widget</span>
        </div>
        <Panel class="flex-1 h-full" pt:header:class="!p-3">
          <template #header>
            <div>{{ query }}</div>
          </template>
          <InvisibleTextInput
            id="newDocumentContent"
            v-model="newDocumentContent"
            placeholder="Enter widget content..."
            class="w-full h-full break-words"
          />
        </Panel>
      </div>
    </div>
  </div>
</template>
