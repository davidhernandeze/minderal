<script setup>
import useFolder from '@/composables/useFolder.js'
import { useWorkspace } from '@/composables/useWorkspace.js'
import searchStatus from '@/stores/searchStatus.js'
import { nextTick, onMounted, watch } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'
import Button from 'primevue/button'
import { useDocumentVisibility } from '@vueuse/core'
import icon from '@/assets/logo.svg'
import ProgressSpinner from 'primevue/progressspinner'
import InputText from 'primevue/inputtext'
import useIndexLoop from '@/composables/useIndexLoop.js'
import DocRoute from '@/components/DocRoute.vue'

const props = defineProps({
  connectionId: {
    type: String,
    required: true,
  },
})

const visibility = useDocumentVisibility()
watch(visibility, (current, previous) => {
  if (current === 'visible' && previous === 'hidden') {
    document.getElementById('mainInput').focus()
  }
})

const workspace = useWorkspace({ connectionId: props.connectionId })
const { connectDB, currentRoute, setCurrentDoc, currentDoc } = workspace

onMounted(async () => {
  await connectDB()
  await nextTick()
  document.getElementById('mainInput').focus()
})

const { searching, query } = searchStatus
const { filteredDocuments } = useFolder(workspace.childDocs, query)
const { currentIndex, increment, decrement } = useIndexLoop(filteredDocuments)

function tabClickAction() {
  increment()
  document.getElementById('mainInput').focus()
}

function tabShiftClickAction() {
  decrement()
  document.getElementById('mainInput').focus()
}

async function navigateToDoc() {
  query.value = ''
  await setCurrentDoc(filteredDocuments.value?.[currentIndex.value]._id)
}

function navigateBack() {
  query.value = ''
  if (currentDoc.value.parentId === '') return
  setCurrentDoc(currentDoc.value.parentId)
}
</script>
<template>
  <div
    @keydown.prevent.tab.exact="tabClickAction"
    @keydown.prevent.shift.tab="tabShiftClickAction"
    @keydown.prevent.right="tabClickAction"
    @keydown.prevent.left="tabShiftClickAction"
    @keyup.prevent.enter="navigateToDoc"
    @keyup.delete="navigateBack"
  >
    <DocRoute class="text-2xl" :route="currentRoute" @navigate="(id) => setCurrentDoc(id)" />
    <div class="flex items-center">
      <ProgressSpinner
        v-if="searching"
        style="width: 1.5rem; height: 1.5rem"
        strokeWidth="8"
        fill="transparent"
        animationDuration="0.6s"
        aria-label="Custom ProgressSpinner"
      />
      <img v-else :src="icon" alt="logo" class="w-[1.5rem] h-[1.5rem]" />
      <InputText
        v-focustrap
        id="mainInput"
        v-model="query"
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
          @focus="currentIndex = index"
          @pointerenter="currentIndex = index"
          @click="navigateToDoc"
          size="small"
          raised
          :outlined="index !== currentIndex"
          :label="doc.name"
          :icon="getWidgetProps(doc.widget).icon"
        />
      </div>
    </div>
  </div>
</template>
