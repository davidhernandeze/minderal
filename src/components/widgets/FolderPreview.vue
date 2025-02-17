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
  <div class="flex p-2 items-center box-border gap-2 hover:text-white cursor-pointer text-2xl">
    <i class="fa-solid fa-folder mx-1" />
    <p class="break-all truncate">
      {{ doc.name }}
    </p>
  </div>
</template>
