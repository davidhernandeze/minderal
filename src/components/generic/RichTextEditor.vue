<script setup>
import Quill from 'quill'
import { defineModel, onMounted, useTemplateRef, watch } from 'vue'
const value = defineModel()
const editor = useTemplateRef('editor')

const emit = defineEmits(['input'])

let quill

watch(value, (newValue) => {
  quill.setContents(newValue)
})

onMounted(() => {
  quill = new Quill(editor.value, {
    placeholder: 'Type something...',
    theme: 'bubble',
    bounds: editor.value,
    modules: {
      toolbar: [
        ['bold', 'italic'],
        [{ list: 'ordered' }, { list: 'bullet' }]
      ]
    }
  })

  quill.setContents(value.value)

  quill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'api') {
      // console.log('An API call triggered this change.')
    } else if (source === 'user') {
      // console.log('A user action triggered this change.')
      emit('input', quill.getContents())
    }
  })
})
</script>
<template>
  <div
    ref="editor"
  />
</template>
