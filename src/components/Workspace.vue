<template>
  <div class="relative w-full h-full">
    <div
      v-if="database"
      class="text-green-400 fixed top-0 right-0 m-1 text-xs"
    >
      <span>db: {{ database.id }}</span>
      <span
        class="ml-5"
        @click="currentDoc = null"
      >
        doc: {{ currentDocumentId || 'root' }}
      </span>
    </div>

    <div class="p-4">
      <div class="mt-2 mb-4 flex items-center">
        <DocumentRoute
          :route="currentRoute"
          @navigate="(documentId) => database.setCurrentDocument(documentId)"
        />
      </div>
      <div class="flex">
        <input
          ref="searchInput"
          v-model="searchQuery"
          class="border-none bg-transparent p-1 w-1/2 my-3 focus:outline-none"
          type="text"
          placeholder="Search..."
        >
      </div>

      <div class="grid grid-cols-3 lg:grid-cols-4 gap-4 mt-4 w-full">
        <WidgetWrapper
          v-for="document in filteredDocuments"
          :key="document._id"
          :document="document"
          @click="database.setCurrentDocument(document._id)"
        />
      </div>
    </div>
    <div
      v-if="database"
      class="absolute mb-20 bottom-0 flex justify-center items-center w-full"
    >
      <button
        class="border p-2 focus:border-green-500 active:border-green-500 rounded mr-1"
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
      <input
        ref="mainInput"
        v-model="inputValue"
        class="text-gray-50 rounded text-md p-2 w-96 bg-gray-800"
        type="text"
        @keyup.enter="createDocument"
      >
      <span
        class="ml-2 text-gray-100"
        @click="createDocument"
      >Enter to save</span>
    </div>

    <SelectWidgetModal
      :open-modal="isTypesModalOpen"
      @close="isTypesModalOpen = false"
      @select="selectWidget"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getDatabaseConnection } from '@/functions/database.js'
import DocumentRoute from '@/components/DocumentRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import WidgetWrapper from '@/components/WidgetWrapper.vue'
import { widgets } from '@/enums/widgets.js'
import SelectWidgetModal from '@/components/SelectWidgetModal.vue'

const props = defineProps({ databaseId: { type: String, default: null } })

const database = getDatabaseConnection(props.databaseId)
const documents = database.documents
const currentDocumentId = database.currentDocumentId
const currentRoute = database.currentRoute

const mainInput = ref(null)
const inputValue = ref('')
const currentDoc = ref(null)

const searchInput = ref(null)
const searchQuery = ref('')

const keys = useMagicKeys()
const shiftCtrlA = keys['Ctrl+K']

const isTypesModalOpen = ref(false)
const selectedWidget = ref(widgets.text)
const iconRerender = ref(true)

watch(shiftCtrlA, (v) => {
  if (!v) return
  searchInput.value.focus()
})

const filteredDocuments = computed(() => {
  return documents.value.filter((doc) => {
    let searchableContent = doc.name
    if (doc.index_value) {
      searchableContent += ' ' + doc.value
    }
    return searchableContent.toLowerCase().indexOf(searchQuery.value.toLowerCase()) > -1
  })
})

onMounted(async () => {
  if (database.value) mainInput.value.focus()
  await database.fetchDocuments()
})

async function createDocument () {
  await database.createDocument(inputValue.value, selectedWidget.value.index)
  inputValue.value = ''
}

async function deleteDocument (document) {
  await database.deleteDocument(document)
}

async function selectWidget (widget) {
  selectedWidget.value = widget
  isTypesModalOpen.value = false
  iconRerender.value = false
  await nextTick()
  iconRerender.value = true
}
</script>
