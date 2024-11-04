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
  <div class="flex h-full items-center box-border gap-2 hover:text-white">
    <i class="fa-solid fa-folder h-8 mx-1" />
    <p class="text-[1.5rem] break-all">
      {{ doc.name }}
    </p>
  </div>
</template>
