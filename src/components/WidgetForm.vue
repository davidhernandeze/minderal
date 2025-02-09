<script setup>
import { defineAsyncComponent, inject } from 'vue'

const props = defineProps({
  widget: {
    type: Object,
    required: true,
  },
  doc: {
    type: Object,
    required: false,
    default: () => ({}),
  },
})

const emit = defineEmits(['save'])

const action = props.doc._id ? 'Edit' : 'New'

const Form = defineAsyncComponent(() => {
  return import(`./widgets/${props.widget.formComponent}.vue`)
})

const workspace = inject('workspace')

async function saveDoc(form) {
  const name = form.name
  const content = form.content

  if (form._id) {
    await workspace.updateDoc({ ...form })
    emit('save')
    return
  }

  await workspace.createDoc({
    name,
    content,
    widget: form.widget,
    files: form.files,
  })
  emit('save')
}
</script>
<template>
  <div>
    <h1 class="mb-4 text-gray-200 text-xl">{{ action }} {{ widget.label }}</h1>
    <Form :doc="doc" @save="saveDoc" />
  </div>
</template>
