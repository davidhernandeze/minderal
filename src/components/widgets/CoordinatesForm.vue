<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import Button from 'primevue/button'
import { Geolocation } from '@capacitor/geolocation'

const props = defineProps({
  doc: {
    type: Object,
    required: true,
  },
})

const emits = defineEmits(['submit'])

const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'coordinates',
  content: props.doc?.content || {},
})

function submit() {
  emits('submit', form.value)
}

const error = ref('')
async function setFromCurrentLocation() {
  try {
  const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: false })
    form.value.content = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      altitude: coordinates.altitude,
    }
  } catch (e) {
    console.error(e)
    error.value = 'Could not get current location'
  }
}
</script>

<template>
  <form class="text-gray-200 text-xl" @submit.prevent="submit">
    <TextInput v-model:value="form.name" label="Name" type="text" class="my-3 w-full" />
    <div class="flex gap-4">
      <TextInput v-model:value="form.content.latitude" label="Latitude" type="text" class="my-3" />
      <TextInput
        v-model:value="form.content.longitude"
        label="Longitude"
        type="text"
        class="my-3"
      />
      <TextInput v-model:value="form.content.altitude" label="Altitude" type="text" class="my-3" />
    </div>
    <div>
      <Button
        @click="setFromCurrentLocation"
        label="Set from current location"
        size="small"
        variant="text"
      />
      <p class="text-red-500 text-sm">{{ error }}</p>
    </div>
    <GenericButton class="bg-indigo-600 hover:bg-indigo-500 mt-10" type="submit">
      Update
    </GenericButton>
  </form>
</template>
