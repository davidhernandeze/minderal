<template>
  <div>
    <label
      :for="inputId"
      class="block text-sm font-medium"
    >{{ label }}</label>
    <div class="mt-1 relative rounded-md shadow-sm pr-4">
      <input
        :id="inputId"
        :type="type"
        :value="value"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full block pr-10 focus:outline-none sm:text-sm rounded-md bg-gray-900"
        :class="[error ? 'text-red-900 border-red-300 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500', disabled ? 'text-gray-400' : '']"
        :aria-invalid="!!error"
        :aria-describedby="errorAreaId"
        @input="event => $emit('update:value', event.target.value)"
      >
      <div
        v-if="error"
        class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"
      >
        <i class="fa-solid fa-exclamation h-3" />
      </div>
    </div>
    <p
      v-if="error"
      :id="errorAreaId"
      class="mt-1 text-sm text-red-600"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup>
import { v4 as getId } from 'uuid'

defineEmits(['update:value'])

defineProps({
  type: {
    type: String,
    default: 'text'
  },
  label: {
    type: String,
    default: ''
  },
  value: {
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
  }
})

const inputId = getId()
const errorAreaId = getId()
</script>
