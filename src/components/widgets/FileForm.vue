<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import Button from 'primevue/button'
import { FilePicker } from '@capawesome/capacitor-file-picker'

const props = defineProps({
  doc: {
    type: Object,
    required: false,
  },
})

const emits = defineEmits(['submit'])

const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'file',
  content: '',
  files: [],
})

function submit() {
  emits('submit', form.value)
}

async function pickFile() {
  try {
    const result = await FilePicker.pickFiles()
    const file = result.files[0]

    if (!file.blob) return

    form.value.name = form.value.name === '' ? file.name : form.value.name

    form.value.files.push({
      name: file.name,
      format: file.mimeType,
      data: file.blob,
    })
  } catch (e) {
    console.log('Error picking file', e)
    console.error(e)
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <TextInput v-model:value="form.name" label="Name" type="text" class="my-3 w-full" />

    <Button icon="bi bi-file-earmark" @click="pickFile" />

    <div v-if="form.files.length > 0" class="my-4 flex gap-4 text-lg">
      <i class="bi bi-file-earmark" />
      <p>{{ form.files[0].name || 'Current file' }}</p>
    </div>

    <div v-if="form.files.length > 0" class="flex justify-end">
      <Button type="submit">Save</Button>
    </div>
  </form>
</template>
