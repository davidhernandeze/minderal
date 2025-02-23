<script setup>
import { onMounted } from 'vue'
import { Doc } from '@/classes/Doc.js'
import useImage from '@/composables/useImage.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const { attachmentUrl, fetchImage } = useImage(props.doc)

onMounted(() => {
  fetchImage()
})
</script>

<template>
  <div class="h-full flex-center">
    <img class="h-full w-auto" :src="attachmentUrl"  :alt="doc.name"/>
  </div>
</template>
