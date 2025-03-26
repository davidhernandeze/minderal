<script setup>
import { onMounted, ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import Button from 'primevue/button'
import { Camera, CameraResultType } from '@capacitor/camera'
import { base64ImageToBlob } from '@/utils/files.js'
import useImage from '@/composables/useImage.js'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Object,
    default: null,
    required: false
  }
})

const emits = defineEmits(['submit'])

const { attachmentUrl, fetchImage } = useImage(toRef(props.doc))

onMounted(() => {
  fetchImage()
})

const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'image',
  content: '',
  files: []
})

function submit() {
  emits('submit', form.value)
}

async function openCamera() {
  try {
    const photo = await Camera.getPhoto({
      quality: 100,
      allowEditing: true,
      resultType: CameraResultType.Base64
    })
    attachmentUrl.value = `data:${photo.format};base64,${photo.base64String}`
    form.value.files.push({
      name: photo.path,
      format: `image/${photo.format}`,
      data: base64ImageToBlob(photo.base64String, `image/${photo.format}`)
    })
  } catch (e) {
    console.error(e)
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <TextInput v-model="form.name" label="Name" type="text" class="my-3 w-full" />

    <Button icon="bi bi-camera" @click="openCamera" />

    <img v-if="attachmentUrl" :src="attachmentUrl" alt="New image" class="my-3 h-[12rem]" />

    <div v-if="attachmentUrl" class="flex justify-end">
      <Button type="submit">Save</Button>
    </div>
  </form>
</template>
