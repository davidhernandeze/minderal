<script setup>
import { Doc } from '@/classes/Doc.js'
import UrlMetadata from '@/components/UrlMetadata.vue'

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
    :href="doc.content.url"
    target="_blank"
    class="h-full"
  >
    <UrlMetadata :url-preview="doc.content" />
  </a>
</template>
