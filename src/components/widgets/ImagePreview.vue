<script setup>
import { onMounted } from 'vue'
import { Doc } from '@/classes/Doc.js'
import useImage from '@/composables/useImage.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { attachmentUrl, fetchImage } = useImage(props.doc)

onMounted(() => {
  fetchImage()
})

</script>

<template>
  <div class="text-xs overflow-y-hidden h-full flex-center">
    <img
      class="h-full"
      :src="attachmentUrl"
    >
  </div>
</template>
