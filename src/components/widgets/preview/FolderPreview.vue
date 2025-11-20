<script setup>
import { Doc } from '@/classes/Doc.js'

defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
</script>

<template>
  <div
    class="flex h-full items-start box-border gap-2 hover:text-(--p-primary-500) cursor-pointer text-2xl"
  >
    <i class="bi bi-folder mx-1" />
    <p class="break-all truncate">
      {{ doc.name }}
    </p>
  </div>
</template>
