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
  <div class="flex justify-center h-full items-center box-border text-2xl">
    <div class="cursor-pointer">
      <div class="flex justify-center">
        <i class="bi bi-chat" />
      </div>
      <div class="flex justify-center">
        {{ doc.name }}
      </div>
    </div>
  </div>
</template>
