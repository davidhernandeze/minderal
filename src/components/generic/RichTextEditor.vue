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
  if (value.value?.ops) {
    quill.setContents(value.value)
  } else {
    quill.setContents([
      { insert: value.value }
    ])
    emit('input', quill.getContents())
  }

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
<style>
.ql-editor.ql-blank::before{
  color: #9da19f;
}
</style>
