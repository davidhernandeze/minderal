<script setup>
import SwitchInput from '@/components/SwitchInput.vue'
import { Doc } from '@/types.js'

defineEmits(['update'])
defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
</script>

<template>
  <div class="flex justify-center h-full items-start box-border">
    <div>
      <div
        class="flex justify-center h-7"
        @click.stop="$emit('update', !doc.value)"
      >
        <SwitchInput
          :model-value="doc.value"
        />
      </div>
      <div class="text-sm mt-1">
        {{ doc.name }}
      </div>
    </div>
  </div>
</template>
