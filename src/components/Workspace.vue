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

      <div class="flex flex-wrap gap-4 justify-start mt-4 w-full">
        <div
          v-for="document in filteredDocuments"
          :key="document._id"
          class="relative bg-gray-700 hover:bg-gray-800 w-64 cursor-pointer rounded overflow-hidden"
          @click="database.setCurrentDocument(document._id)"
        >
          <div
            class="absolute top-0 right-0 px-1 hover:text-white bg-red-500"
            @click.stop="deleteDocument(document)"
          >
            x
          </div>
          <div
            class="w-2/3 text-xs text-green-200 p-1 truncate"
          >
            <p>id: {{ document._id }}</p>
            <p>parent_id: {{ document.parent_id }}</p>
            <p>order: {{ document.order }}</p>
          </div>
          <div class="p-2">
            <p>{{ document.value }}</p>
          </div>
        </div>
      </div>
    </div>
    <div
      v-if="database"
      class="absolute mb-20 bottom-0 flex justify-center items-center w-full"
    >
      <input
        ref="mainInput"
        v-model="inputValue"
        class="text-gray-900 rounded text-md p-2 w-96"
        type="text"
        @keyup.enter="createDocument"
      >
      <span class="ml-2 text-gray-100">Enter to save</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getDatabaseConnection } from '@/functions/database.js'
import DocumentRoute from '@/components/DocumentRoute.vue'
import { useMagicKeys } from '@vueuse/core'

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

watch(shiftCtrlA, (v) => {
  if (!v) return
  searchInput.value.focus()
})

const filteredDocuments = computed(() => {
  return documents.value.filter((doc) => doc.value?.toLowerCase().indexOf(searchQuery.value.toLowerCase()) > -1)
})

onMounted(async () => {
  if (database.value) mainInput.value.focus()
  await database.fetchDocuments()
})

async function createDocument () {
  await database.createDocument(inputValue.value)
  inputValue.value = ''
}

async function deleteDocument (document) {
  await database.deleteDocument(document)
}
</script>
