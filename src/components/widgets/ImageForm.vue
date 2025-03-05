<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import Button from 'primevue/button'
import { Camera, CameraResultType } from '@capacitor/camera'
import { base64ImageToBlob } from '@/utils/files.js'

const emits = defineEmits(['submit'])

const photoUrl = ref(null)
const form = ref({
  name: '',
  widget: 'image',
  content: '',
  files: []
})

function submit () {
  emits('submit', form.value)
}

async function openCamera () {
  try {
    const photo = await Camera.getPhoto({
      quality: 100,
      allowEditing: true,
      resultType: CameraResultType.Base64,
    })
    photoUrl.value = `data:${photo.format};base64,${photo.base64String}`
    form.value.files.push({
      name: photo.path,
      format: `image/${photo.format}`,
      data: base64ImageToBlob(photo.base64String, `image/${photo.format}`),
    })
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <TextInput v-model:value="form.name" label="Name" type="text" class="my-3 w-full" />

    <Button icon="bi bi-camera" @click="openCamera" />

    <img v-if="photoUrl" :src="photoUrl" alt="New image" class="my-3 h-[12rem]" />

    <div v-if="photoUrl" class="flex justify-end">
      <Button class="bg-indigo-600 hover:bg-indigo-500 mt-6" type="submit">Save</Button>
    </div>
  </form>
</template>
