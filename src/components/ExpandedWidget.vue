<template>
  <Widget
    :expanded="true"
    :document="document"
    @navigate="(documentId) => $emit('navigate', documentId)"
    @update="(value) => database.updateDocument(document, value)"
  />
</template>
<script setup>
import { defineAsyncComponent, inject } from 'vue'

const database = inject('database')
const { currentDocument } = database
defineEmits(['navigate'])

const Widget = defineAsyncComponent(() => {
  let type = 'folder'
  if (currentDocument.value) {
    type = currentDocument.value.type
  }
  const componentName = type.charAt(0).toUpperCase() + type.slice(1)
  return import(`./widgets/${componentName}.vue`)
})

const document = database.currentDocument

</script>
