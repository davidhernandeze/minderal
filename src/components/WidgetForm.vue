<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { Workspace } from '@/domain'

const { workspace, typeKey } = defineProps<{
  workspace: Workspace,
  typeKey: string
}>()

const emit = defineEmits(['save'])

const action = workspace.widgetOnEdit ? 'Edit' : 'New'
const widgetTypeDefinition = workspace.getWidgetTypeDefinition(typeKey)

const Form = defineAsyncComponent(() => {
  return import(`./widgets/forms/${widgetTypeDefinition.formComponent}.vue`)
})

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
    <h1 class="mb-4 text-gray-200 text-xl">{{ action }} {{ widgetTypeDefinition.label }}</h1>
<!--    <Form :key="doc._rev" :doc="doc" @submit="saveDoc" />-->
  </div>
</template>
