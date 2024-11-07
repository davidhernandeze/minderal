<script setup>
import { defineAsyncComponent, inject } from 'vue'
import { getWidgetKey } from '@/enums/widgets.js'

const props = defineProps({
  widget: {
    type: Object,
    required: true
  }
})

const Form = defineAsyncComponent(() => {
  return import(`./widgets/${props.widget.formComponent}.vue`)
})

const workspace = inject('workspace')

async function saveDoc (form) {
  const name = form.name
  const content = form.content

  await workspace.createDoc({
    name,
    content,
    widget: form.widget,
    files: form.files
  })
}
</script>
<template>
  <Form @save="saveDoc" />
</template>
