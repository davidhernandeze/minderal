<script setup lang="ts">
import { Application, Widget } from '@/domain/index.js'
import { inject } from 'vue'

const { widget } = defineProps<{
  widget: Widget
}>()

const app = inject<Application>('app')
</script>

<template>
  <button
    class="flex h-full items-center box-border gap-2 hover:text-(--p-primary-500) cursor-pointer text-2xl"
    @click.middle="app.openNewTab(widget.db, widget.docId)"
    @click="widget.openInWorkspace()"
  >
    <i class="bi bi-folder mx-1" />
    <p class="break-all truncate">
      {{ widget.doc.name }}
    </p>
  </button>
</template>
