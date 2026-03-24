<script setup lang="ts">
import { defineAsyncComponent, computed } from 'vue'
import safeImport from '@/utils/safe-import.js'
import type { Widget } from '@/domain/Widget'

const { widget } = defineProps<{ widget: Widget }>()

const PreviewComponent = computed(() => {
  if (!widget.previewComponent) return null
  return defineAsyncComponent(() =>
    safeImport(() => import(`./widgets/preview/${widget.previewComponent}.vue`))
  )
})
</script>

<template>
  <component :is="PreviewComponent" v-if="PreviewComponent" :widget="widget" />
</template>
