<template>
  <div
    v-if="currentDatabase"
    class="text-green-400"
  >
    <span>db: {{ currentDatabase.name }}</span>
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
      doc: {{ selectedDoc?._id }}
    </span>
  </div>
  <div class="flex flex-wrap gap-4 justify-center mt-4">
    <div
      v-for="doc in docs"
      :key="doc._id"
      class="relative bg-gray-700 hover:bg-gray-800 w-64 cursor-pointer rounded overflow-hidden"
      @click="selectedDoc = doc"
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
      @keyup.enter="saveDoc"
    >
    <span class="ml-2 text-gray-100">Enter to save</span>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import useDatabase from '@/composables/database.js'
import sourcesStore from '@/store/sources.js'

const { currentDatabase, selectDatabase, getDocs, docs, selectedDoc, createDoc, deleteDoc } = useDatabase()

const mainInput = ref(null)
const inputValue = ref('')
const currentDoc = ref(null)

onMounted(async () => {
  console.log(sourcesStore.doc)
  if (currentDatabase.value) mainInput.value.focus()
})

watch(sourcesStore.doc, async () => {
  // if (currentDatabase.value) return
  // if (!metaDoc.value.local_dbs.length) return
  // selectDatabase(metaDoc.value.local_dbs[0])
  // await getDocs()
})

async function saveDoc () {
  await createDoc(inputValue.value)
  inputValue.value = ''
}

async function deleteCurrentDatabase () {
  await sourcesStore.deleteDatabase(currentDatabase.id)
}
</script>
