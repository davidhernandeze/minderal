<template>
  <div class="relative w-48 h-screen h-max-screen bg-gray-700 shadow-md">
    <div class="p-1">
      minderal
    </div>
    <div
      v-for="(source, index) in sourcesDoc?.sources"
      :key="source.id"
      class="bg-gray-600 p-2"
    >
      <div class="text-xs font-bold uppercase">
        {{ source.name }}
      </div>
      <ul class="my-1">
        <li
          v-for="database in source.databases"
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
          @keyup.enter="createDatabase(index)"
        >
        <div
          v-else
          class="cursor-pointer text-xs font-bold"
          @click="showDatabaseNameInput"
        >
          + CREATE DB
        </div>
      </div>
    </div>
    <div
      class="cursor-pointer text-xs font-bold mt-4"
      @click="showCreateDatabaseInput"
    >
      + ADD REMOTE
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import sourcesStore from '@/store/sources.js'
import useDatabase from '@/composables/database.js'

const sourcesDoc = sourcesStore.doc

const { selectDatabase, currentDatabase } = useDatabase()

const newDatabaseNameInput = ref(null)
const newDatabaseName = ref('')
const isCreatingDatabase = ref(false)

async function showDatabaseNameInput () {
  isCreatingDatabase.value = true
  await nextTick()
  newDatabaseNameInput.value.focus()
}

async function createDatabase (sourceIndex) {
  await sourcesStore.createDatabase(sourceIndex, newDatabaseName.value)
  newDatabaseName.value = ''
  newDatabaseNameInput.value.blur()
}
</script>
