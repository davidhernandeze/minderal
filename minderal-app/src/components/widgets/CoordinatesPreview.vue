<script setup>
import { Doc } from '@/classes/Doc.js'

defineEmits(['update'])
defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
</script>

<template>
  <a
    :href="`https://www.google.com/maps/search/?api=1&query=${doc.content.latitude},${doc.content.longitude}`"
    target="_blank"
    class="h-full break-words"
  >
    <p>Latitude: {{ doc.content.latitude }}</p>
    <p>Longitude: {{ doc.content.longitude }}</p>
    <p v-if="doc.content.altitude">Altitude: {{ doc.content.altitude }}</p>
  </a>
</template>
