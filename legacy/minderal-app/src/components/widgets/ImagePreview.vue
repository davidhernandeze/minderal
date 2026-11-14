<script setup>
import { onMounted } from 'vue'
import { Doc } from '@/classes/Doc.js'
import useImage from '@/composables/useImage.js'
import ProgressSpinner from 'primevue/progressspinner'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { attachmentUrl, fetchImage } = useImage(toRef(props, 'doc'))

onMounted(() => {
  fetchImage()
})
</script>

<template>
  <div class="h-full flex-center cursor-pointer">
    <ProgressSpinner
      v-if="!attachmentUrl"
      style="width: 30px; height: 30px"
      stroke-width="8"
      fill="transparent"
      animation-duration="0.6s"
      aria-label="Custom ProgressSpinner"
    />
    <img v-else class="h-full w-auto" :src="attachmentUrl" :alt="doc.name" />
  </div>
</template>
