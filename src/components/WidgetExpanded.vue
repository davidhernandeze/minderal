<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { Widget } from '@/domain/Widget'

const props = defineProps<{ widget: Widget }>()

const ExpandedWidgetComponent = defineAsyncComponent(() => {
  return import(`./widgets/${props.widget.expandedComponent}.vue`)
})
</script>
<template>
  <ExpandedWidgetComponent :widget="widget" />
</template>
