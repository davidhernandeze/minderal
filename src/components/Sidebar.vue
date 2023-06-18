<template>
  <div class="relative w-48 h-screen h-max-screen bg-gray-700 shadow-md">
    <div class="p-2">
      minderal2
    </div>
    <div class="p-2">
      <div class="text-xs uppercase">
        DATABASES
      </div>
      <ul class="my-1">
        <li
          v-for="database in databases"
          :key="database.id"
          class="p-2 cursor-pointer rounded bg-gray-600 my-2 border border-gray-600 hover:border-gray-500 relative"
          @click="metadataStore.openNewTab(database.id, database.name)"
        >
          <i class="fa-solid fa-circle h-2 text-green-400 absolute top-1 right-1" />
          <div class="text-xs">
            {{ database.name }}
          </div>
          <div class="flex gap-1 mt-2">
            <div
              class="rounded-full h-6 w-6 border border-green-600 text-green-600 flex justify-center items-center hover:text-green-400 hover:border-green-400"
              @click.stop="console.log('asda')"
            >
              <i class="fa-light h-3 fa-pencil" />
            </div>
            <div
              class="rounded-full h-6 w-6 border border-green-600 text-green-600 flex justify-center items-center hover:text-green-400 hover:border-green-400"
              @click.stop="console.log('asda')"
            >
              <i class="fa-light h-3 fa-arrow-up-right-from-square" />
            </div>
            <div
              class="rounded-full h-6 w-6 border border-green-600 text-green-600 flex justify-center items-center hover:text-green-400 hover:border-green-400"
              @click.stop="metadataStore.deleteDatabase(database.id)"
            >
              <i class="fa-light h-3 fa-trash" />
            </div>
          </div>
        </li>
      </ul>
      <div class="mt-4">
        <input
          v-if="isCreatingDatabase"
          ref="newDatabaseNameInput"
          v-model="newDatabaseName"
          class="w-full focus:outline-none border-b bg-transparent"
          type="text"
          @blur="isCreatingDatabase = false"
          @keyup.enter="createDatabase()"
        >
        <div
          v-else
          class="cursor-pointer text-xs font-bold w-full bg-blue-500 rounded p-2"
          @click="showDatabaseNameInput"
        >
          CREATE DB
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { databases } = storeToRefs(metadataStore)

const newDatabaseNameInput = ref(null)
const newDatabaseName = ref('')
const isCreatingDatabase = ref(false)

async function showDatabaseNameInput () {
  isCreatingDatabase.value = true
  await nextTick()
  newDatabaseNameInput.value.focus()
}

async function createDatabase () {
  await metadataStore.createDatabase(newDatabaseName.value)
  newDatabaseName.value = ''
}
</script>

<style>
html {
    font-family: 'Nunito Regular', serif;
}
</style>
