<script setup>
import { Doc } from '@/classes/Doc.js'

defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

</script>

<template>
  <div
    class="text-lg h-full p-4"
    :style="{ 'background-color': doc.settings?.bg_color, color: doc.settings?.text_color }"
  >
    {{ doc.content }}
  </div>
</template>
