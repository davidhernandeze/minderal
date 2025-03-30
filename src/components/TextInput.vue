<script setup>
import { v4 as getId } from 'uuid'
import InputText from 'primevue/inputtext'

defineProps({
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  },
  error: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  }
})

const value = defineModel({ type: [String, Number] })
const inputId = getId()
</script>

<template>
  <div class="flex flex-col gap-2">
    <label :for="inputId" class="block text-sm"> {{ label }} </label>
    <InputText v-model="value" :disabled="disabled" :placeholder="placeholder" :type="type" />
    <p v-show="error" class="mt-1 text-sm text-red-600">
      {{ error }}
    </p>
  </div>
</template>
