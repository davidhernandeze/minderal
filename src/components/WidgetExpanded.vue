<script setup lang="ts">
import { defineAsyncComponent, inject } from 'vue'
import { Widget } from '@/domain/Widget'

const props = defineProps<{ widget: Widget }>()

const workspace = inject('workspace')

const ExpandedWidgetComponent = defineAsyncComponent(() => {
  return import(`./widgets/${props.widget.expandedComponent}.vue`)
})
</script>
<template>
  <ExpandedWidgetComponent
    :doc="doc"
    @update-value="(newValue) => workspace.updateDoc(doc, newValue)"
  />
</template>
