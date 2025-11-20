<script setup lang="ts">
import { defineAsyncComponent, inject } from 'vue'
import { Widget } from '@/domain/index.js'

const { widget } = defineProps<{
  widget: Widget
}>()

const emit = defineEmits(['save'])

const action = widget.doc._id ? 'Edit' : 'New'

const Form = widget.formComponent
  ? null
  : defineAsyncComponent(() => {
      return import(`./widgets/${widget.formComponent}.vue`)
    })

const workspace = inject('workspace')

async function saveDoc(form) {
  if (form._id) {
    await workspace.updateDoc(
      props.doc,
      {
        name: form.name,
        content: form.content,
        widget: form.widget,
        settings: form.settings
      },
      form.files
    )
    emit('save')
    return
  }

  await workspace.createDoc({
    name: form.name,
    content: form.content,
    widget: form.widget,
    files: form.files,
    settings: form.settings
  })
  emit('save')
}
</script>
<template>
  <div>
    <h1 class="mb-4 text-gray-200 text-xl">{{ action }} {{ widget.label }}</h1>
    <Form :key="doc._rev" :doc="doc" @submit="saveDoc" />
  </div>
</template>
