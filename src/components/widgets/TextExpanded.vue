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
  <div class="text-2xl">
    {{ doc.value }}
  </div>
</template>
