<template>
  <div class="h-full flex flex-col bg-gray-700 p-4">
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
        class="border-none bg-transparent p-1 pl-0 focus:outline-none w-full"
        type="text"
        placeholder="Search..."
      >
    </div>
    <div class="grow-0 overflow-y-auto">
      <div class="pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <WidgetWrapper
          v-for="document in filteredDocuments"
          :key="document._id"
          :document="document"
          @navigate="navigate"
          @update="(value) => updateDocumentValue(document, value)"
          @delete="deleteDocument"
        />
      </div>
    </div>
    <div
      class="grow-0 pb-0 p-3"
    >
      <div
        class="flex-center flex-wrap bg-gray-700 shadow-lg rounded"
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

      <SelectWidgetModal
        :open-modal="isTypesModalOpen"
        @close="isTypesModalOpen = false"
        @select="selectWidget"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import DocumentRoute from '@/components/DocumentRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import WidgetWrapper from '@/components/WidgetWrapper.vue'
import { getWidgetList } from '@/enums/widgets.js'
import SelectWidgetModal from '@/components/SelectWidgetModal.vue'
import GenericButton from '@/components/GenericButton.vue'
import { useDatabase } from '@/composables/useDatabase.js'

const props = defineProps({
  databaseId: {
    type: String,
    required: true
  },
  documentId: {
    type: String,
    default: null
  }
})

const emits = defineEmits(['navigate'])

const database = useDatabase(props.databaseId)
const { documents, currentRoute } = database

const mainInput = ref(null)
const inputValue = ref('')

const searchInput = ref(null)
const searchQuery = ref('')

const keys = useMagicKeys()
const shiftCtrlA = keys['Ctrl+K']

const isTypesModalOpen = ref(false)
const selectedWidget = ref(getWidgetList()[0])
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

async function createDocument () {
  await database.createDocument(inputValue.value, selectedWidget.value)
  inputValue.value = ''
}

async function updateDocumentValue (document, value) {
  await database.updateDocument(document, value)
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

async function navigate (documentId) {
  await database.setCurrentDocument(documentId)
  emits('navigate', documentId)
}
</script>
