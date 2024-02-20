<template>
  <Widget
    :doc="doc"
    @update="newValue => db.updateDocument(doc, newValue)"
  />
</template>
<script setup>
import { defineAsyncComponent, inject } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'

const db = inject('db')
const doc = db.currentDocument

const Widget = defineAsyncComponent(() => {
  const widgetInfo = getWidgetProps(db.currentDocument.value?.type || 'folder')
  return import(`./widgets/${widgetInfo.expandedComponent}.vue`)
})

</script>
