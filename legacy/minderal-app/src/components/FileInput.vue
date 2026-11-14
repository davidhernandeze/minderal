<script setup>
import { useDropZone } from '@vueuse/core'
import { useTemplateRef } from 'vue'

const dropZoneRef = useTemplateRef('dropZoneRef')
const fileInputRef = useTemplateRef('fileInputRef')
const files = defineModel('files', { type: Array })

useDropZone(dropZoneRef, {
  onDrop: processFiles,
  dataTypes: [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/jpg'
  ],
  multiple: true,
  preventDefaultForUnhandled: false
})

function processFiles(newFiles) {
  for (const file of newFiles) {
    const blob = new Blob([file], { type: file.type })
    const base64Url = URL.createObjectURL(file)
    files.value[0] = { name: file.name, data: blob, url: base64Url, type: file.type }
  }
}

function onSelect(event) {
  processFiles(event.target.files)
}
</script>
<template>
  <div
    ref="dropZoneRef"
    class="mt-8 w-full h-[12rem] flex-center rounded-sm hover:outline-gray-100 outline-gray-500 outline-dashed cursor-pointer"
    @click="$refs.fileInputRef.click()"
  >
    <p v-if="files.length === 0">Drop image here</p>
    <div v-else class="flex gap-2 h-full overflow-hidden justify-center">
      <div v-for="file in files" :key="file.name" class="w-full h-full">
        <img :key="file.name" class="h-full" :src="file.url" />
      </div>
    </div>
  </div>
  <input ref="fileInputRef" type="file" style="display: none" @change="onSelect" />
</template>
