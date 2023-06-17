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
        <DocumentRoute :route="currentDocumentRoute" />
      </div>

      <div class="flex">
        <div
          class="w-6 h-6 bg-gray-500 flex justify-center items-center rounded-full cursor-pointer"
          @click="toggleSearch"
        >
          <i class="fa-solid h-4 fa-search" />
        </div>
        <input
          v-if="isSearchActive"
          ref="searchInput"
          v-model="searchQuery"
          class="border border-gray-400 bg-transparent rounded ml-3 px-1"
          type="text"
          @blur="toggleSearch"
        >
      </div>

      <div class="flex flex-wrap gap-4 justify-start mt-4 w-full">
        <div
          v-for="document in documents"
          :key="document._id"
          class="relative bg-gray-700 hover:bg-gray-800 w-64 cursor-pointer rounded overflow-hidden"
          @click="database.setCurrentDocument(document)"
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
import { nextTick, onMounted, ref } from 'vue'
import { getDatabaseConnection } from '@/functions/database.js'
import DocumentRoute from '@/components/DocumentRoute.vue'

const props = defineProps({ databaseId: { type: String, default: null } })

const database = getDatabaseConnection(props.databaseId)
const documents = database.documents
const currentDocumentId = database.currentDocumentId
const currentDocumentRoute = database.currentDocumentRoute

const mainInput = ref(null)
const inputValue = ref('')
const currentDoc = ref(null)

const searchInput = ref(null)
const searchQuery = ref('')
const isSearchActive = ref(false)

onMounted(async () => {
  if (database.value) mainInput.value.focus()
  await database.fetchDocuments()
})

async function createDocument () {
  await database.createDocument(inputValue.value)
  inputValue.value = ''
}

async function toggleSearch () {
  isSearchActive.value = !isSearchActive.value
  if (!isSearchActive.value) return
  await nextTick()
  searchInput.value.focus()
}

async function deleteDocument (document) {
  await database.deleteDocument(document)
}
</script>
