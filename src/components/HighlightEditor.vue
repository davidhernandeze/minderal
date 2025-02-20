<script setup>
import Quill from 'quill'
import hljs from 'highlight.js'
import { onMounted, useTemplateRef, watch } from 'vue'

const value = defineModel()
const editor = useTemplateRef('editor')

const emit = defineEmits(['input'])

let quill

watch(value, (newValue) => {
  const Delta = Quill.import('delta')
  quill.setContents(
    new Delta()
      .insert(value.value)
      .insert('\n', { 'code-block': 'bash' })
  )
})

onMounted(() => {
  quill = new Quill(editor.value, {
    placeholder: 'Type something...',
    modules: {
      syntax: { hljs }
    }
  })

  const Delta = Quill.import('delta')
  quill.setContents(
    new Delta()
      .insert(`${value.value}`, { 'code-block': 'bash' })
  )

  quill.on('text-change', (delta, oldDelta, source) => {
    if (source === 'api') {
      // console.log('An API call triggered this change.')
    } else if (source === 'user') {
      // console.log('A user action triggered this change.')
      emit('input', quill.getText())
    }
  })
})
</script>
<template>
  <div
    ref="editor"
    spellcheck="false"
  />
</template>
<style>
.ql-editor.ql-blank::before{
  color: #9da19f;
}
.ql-ui {
  display: none;
}
</style>
