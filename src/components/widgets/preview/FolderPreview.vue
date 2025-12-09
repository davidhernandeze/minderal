<script setup lang="ts">
import { Widget } from '@/domain/index.js'

const { widget } = defineProps<{
  widget: Widget
}>()
</script>

<template>
  <div
    class="flex h-full items-start box-border gap-2 hover:text-(--p-primary-500) cursor-pointer text-2xl"
  >
    <i class="bi bi-folder mx-1" />
    <p class="break-all truncate">
      {{ widget.doc.name }}
    </p>
  </div>
</template>
