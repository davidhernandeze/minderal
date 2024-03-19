<script setup>
import { defineAsyncComponent, inject } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'

const props = defineProps({
  doc: {
    type: Object,
    required: false
  }
})

const workspace = inject('workspace')

const widgetProps = getWidgetProps(props.doc?.widget || 'folder')
const Widget = defineAsyncComponent(() => {
  return import(`./widgets/${widgetProps.expandedComponent}.vue`)
})

</script>
<template>
  <Widget
    :doc="doc"
    @update="newValue => workspace.updateDoc(doc, newValue)"
  />
</template>
