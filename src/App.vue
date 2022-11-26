<template>
  <div class="h-screen w-screen bg-gray-900 text-gray-100">
    <span class="fixed p-2 z-20">minderal</span>

    <div class="flex">
      <div class="relative w-48 h-screen h-max-screen bg-gray-700 shadow-md px-2 pt-10">
        <div class="text-xs font-bold">
          LOCAL DBS
        </div>
        <ul class="my-1">
          <li
            v-for="database in metaDoc?.local_dbs"
            :key="database.id"
            class="py-1 px-2 w-full hover:bg-gray-800 cursor-pointer"
            :class="database.id === currentDatabase?.id ? 'text-green-500' : ''"
            @click="selectDatabase(database)"
          >
            {{ database.name }}
          </li>
        </ul>
        <div>
          <input
            v-if="isCreatingDatabase"
            ref="newDatabaseNameInput"
            v-model="newDatabaseName"
            class="flex-1 focus:outline-none border-b bg-transparent"
            type="text"
            @blur="isCreatingDatabase = false"
            @keyup.enter="createDatabase"
          >
          <div
            v-else
            class="cursor-pointer text-xs font-bold"
            @click="showCreateDatabaseInput"
          >
            + CREATE DB
          </div>
        </div>
      </div>
      <div class="relative flex-1 container max-w-2xl mx-auto px-4 pt-10">
        <div
          v-if="currentDatabase"
          class="text-green-400"
        >
          <span>db: {{ currentDatabase?.name }}</span>
          <button
            class="text-gray-100 bg-red-500 px-1 ml-2 rounded"
            @click="deleteCurrentDatabase"
          >
            delete
          </button>
          <span
            class="ml-5"
            @click="currentDoc = null"
          >
            doc: {{ currentDoc?._id }}
          </span>
        </div>
        <div class="flex flex-wrap gap-4 justify-center mt-4">
          <div
            v-for="doc in docs"
            :key="doc._id"
            class="relative bg-gray-700 hover:bg-gray-800 w-64 cursor-pointer rounded overflow-hidden"
            @click="currentDoc = doc"
          >
            <div
              class="absolute top-0 right-0 px-1 hover:text-white bg-red-500"
              @click.stop="deleteDoc(doc)"
            >
              x
            </div>
            <div
              class="w-2/3 text-xs text-green-200 p-1 truncate"
            >
              <p>id: {{ doc._id }}</p>
              <p>parent_id: {{ doc.parent_id }}</p>
              <p>order: {{ doc.order }}</p>
            </div>
            <div class="p-2">
              <p>{{ doc.value }}</p>
            </div>
          </div>
        </div>

        <div
          v-if="currentDatabase"
          class="absolute mb-20 bottom-0 flex p-4 justify-center items-center w-full"
        >
          <input
            ref="mainInput"
            v-model="inputValue"
            class="text-gray-900 rounded text-md p-2 w-96"
            type="text"
            @keyup.enter="createDoc"
          >
          <input
            v-model="isRootDoc"
            type="checkbox"
            class="ml-2"
          >
          <span class="ml-2 text-gray-100">Enter to save</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import db from '@/store/database.js'
import { nextTick, onMounted, ref } from 'vue'

const mainInput = ref(null)
const inputValue = ref('')
const isRootDoc = ref(true)
const docs = ref([])
const { metaDoc } = db
const currentDatabase = ref(null)
const newDatabaseNameInput = ref(null)
const newDatabaseName = ref('')
const isCreatingDatabase = ref(false)
const currentDoc = ref(null)

onMounted(async () => {
  if (currentDatabase.value) mainInput.value.focus()
  await db.init()
  if (!metaDoc.value.local_dbs.length) return
  await selectDatabase(metaDoc.value.local_dbs[0])
})

async function selectDatabase (database) {
  if (!database) return
  db.selectDatabase(database.id)
  currentDatabase.value = database
  await fetchDocs()
}

async function showCreateDatabaseInput () {
  isCreatingDatabase.value = true
  await nextTick()
  newDatabaseNameInput.value.focus()
}

async function createDatabase () {
  await db.createDatabase(newDatabaseName.value)
  newDatabaseName.value = ''
  newDatabaseNameInput.value.blur()
  await selectDatabase(metaDoc.value.local_dbs[metaDoc.value.local_dbs.length - 1])
}

async function deleteCurrentDatabase () {
  if (!currentDatabase.value) return
  await db.deleteDatabase(currentDatabase.value.id)
  docs.value = []
  currentDatabase.value = null
  if (!metaDoc.value.local_dbs.length) return
  await selectDatabase(metaDoc.value.local_dbs[0])
}

async function createDoc () {
  const docsLength = docs.value.length
  await db.storeNewDoc({
    value: inputValue.value,
    parent_id: currentDoc.value?._id ?? false,
    order: docsLength ? docs.value[docsLength - 1].order + 100 : 0
  })
  inputValue.value = ''
  await fetchDocs()
}

async function deleteDoc (doc) {
  await db.deleteDoc(doc)
  await fetchDocs()
}

async function fetchDocs () {
  docs.value = await db.getRootDocs()
}

</script>
