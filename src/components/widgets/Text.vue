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
  <div class="text-xs overflow-y-scroll h-full">
    {{ doc.content }}
  </div>
</template>
