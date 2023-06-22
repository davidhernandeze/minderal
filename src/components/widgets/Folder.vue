<template>
  <div
    v-if="!expanded"
    class="flex justify-center h-full items-center box-border"
  >
    <div>
      <div class="flex justify-center">
        <i class="fa-solid fa-folder h-10 hover:h-11" />
      </div>
      <div class="flex justify-center">
        {{ document.name }}
      </div>
    </div>
  </div>
  <div v-else>
    <div class="pr-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <WidgetWrapper
        v-for="widget in filteredDocuments"
        :key="widget._id"
        :document="widget"
        @navigate="$emit('navigate', widget._id)"
        @update="(value) => updateDocumentValue(widget, value)"
        @delete="deleteDocument"
      />
    </div>
  </div>
</template>

<script setup>
import WidgetWrapper from '@/components/WidgetWrapper.vue'
import { computed, inject } from 'vue'

defineEmits(['navigate'])

defineProps({
  document: {
    type: Object,
    default: null
  },
  expanded: {
    type: Boolean,
    default: false
  }
})

const database = inject('database')
const searchQuery = inject('searchQuery')
const { documents } = database

const filteredDocuments = computed(() => {
  return documents.value.filter((doc) => {
    let searchableContent = doc.name
    if (doc.index_value) {
      searchableContent += ' ' + doc.value
    }
    return searchableContent.toLowerCase().indexOf(searchQuery.value.toLowerCase()) > -1
  })
})

async function updateDocumentValue (document, value) {
  await database.updateDocument(document, value)
}

async function deleteDocument (document) {
  await database.deleteDocument(document)
}
</script>
