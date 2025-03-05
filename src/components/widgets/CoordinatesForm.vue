<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
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
  content: props.doc?.content || {
    latitude: '0',
    longitude: '0',
    altitude: '0',
  },
})

function submit() {
  emits('submit', form.value)
}

const error = ref('')

async function setFromCurrentLocation() {
  try {
    const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true })
    const { latitude, longitude, altitude } = coordinates.coords
    form.value.content = { latitude, longitude, altitude }
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
    <div class="flex justify-end">
      <Button @click="submit">Save</Button>
    </div>
  </form>
</template>
