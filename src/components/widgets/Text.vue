<script setup>
import { Doc } from '@/types.js'

defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
</script>

<template>
  <div class="text-xs">
    {{ doc.value }}
  </div>
</template>
