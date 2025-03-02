<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import Button from 'primevue/button'
import { useGeolocation } from '@vueuse/core'

const { coords, error } = useGeolocation()

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

function setFromCurrentLocation() {
  console.log(error.value)
  console.log(coords.value)
  form.value.content = {
    latitude: coords.value.latitude,
    longitude: coords.value.longitude,
    altitude: coords.value.altitude,
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
      <p class="text-red-500 text-sm">{{ error?.message }}</p>
    </div>
    <GenericButton class="bg-indigo-600 hover:bg-indigo-500 mt-10" type="submit">
      Update
    </GenericButton>
  </form>
</template>
