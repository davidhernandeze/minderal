<template>
  <Modal v-model:is-open="isOpen">
    <template #body>
      <div class="text-gray-50 my-4">
        <div class="flex items-center px-4">
          <input
            ref="searchTypeInput"
            v-model="searchTypeValue"
            class="text-gray-50 rounded text-md p-2 bg-gray-700 w-full"
            type="text"
            placeholder="Search widget..."
          >
        </div>

        <div class="p-4 grid grid-cols-4 gap-2">
          <button
            v-for="(type, index) in types"
            :key="index"
            class="flex items-center border rounded-full p-1 px-2 hover:bg-gray-700 cursor-pointer text-sm shadow-sm"
            @click="isOpen = false; emits('select', index)"
          >
            <i
              :class="type.icon"
              class="h-3 mr-2"
            />
            {{ type.label }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>
<script setup>
import { types } from '@/enums/types.js'
import { ref, watch } from 'vue'

const isOpen = ref(false)

const searchTypeInput = ref(null)
const searchTypeValue = ref('')

const emits = defineEmits(['close', 'select'])
const props = defineProps({
  openModal: {
    required: true,
    type: Boolean
  }
})
watch(() => props.openModal, (value) => {
  if (value) isOpen.value = true
})

watch(isOpen, () => {
  emits('close')
})

</script>
