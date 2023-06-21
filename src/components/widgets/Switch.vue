<template>
  <div class="flex justify-center h-full items-start box-border">
    <div>
      <div @click.stop="$emit('update', !document.value)" class="flex justify-center h-7">
        <SwitchInput
          :model-value="document.value"
        />
      </div>
      <div class="text-sm mt-1">{{ document.name }}</div>
    </div>
  </div>
</template>

<script setup>
import SwitchInput from '@/components/SwitchInput.vue'

defineEmits(['update'])
defineProps({
  document: {
    type: Object,
    required: true
  }
})
</script>
