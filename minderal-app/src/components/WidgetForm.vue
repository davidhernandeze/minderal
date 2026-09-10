<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { Widget } from '@/domain'
import safeImport from '@/utils/safe-import'

const { widget } = defineProps<{
  widget: Widget
}>()

const emit = defineEmits(['save'])

const widgetForm = widget.getFormStructure()

const Form = defineAsyncComponent(() =>
  safeImport(() => import(`./widgets/form/${widget.formComponent}.vue`))
)
async function saveDoc(form) {
  widget.updateDocFromForm(form)
  await widget.save()
  emit('save')
}
</script>
<template>
  <Form :form-structure="widgetForm" @submit="saveDoc" />
</template>
