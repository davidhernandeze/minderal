<template>
  <div class="flex justify-center h-full items-center box-border">
    <div>
      <div class="flex justify-center">
        <i class="fa-solid fa-folder h-10 hover:h-11" />
      </div>
      <div class="flex justify-center">
        {{ doc.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { Doc } from '@/types.js'

defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
</script>
