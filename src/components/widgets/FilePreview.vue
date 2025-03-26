<script setup>
import { onMounted } from 'vue'
import { Doc } from '@/classes/Doc.js'
import ProgressSpinner from 'primevue/progressspinner'
import { toRef } from '@vueuse/core'
import useFile from '@/composables/useFile.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { attachmentUrl, fetchFile, format } = useFile(toRef(props, 'doc'))

onMounted(() => {
  fetchFile()
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
    <!--    <a v-else target="_blank" class="h-full w-auto" :href="attachmentUrl">Open</a>-->
    <iframe v-else-if="format === 'application/pdf'" class="w-full h-full" :src="attachmentUrl" />
    <i v-else class="bi bi-file-earmark text-[3rem]" />
  </div>
</template>
