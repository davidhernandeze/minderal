<template>
  <div class="flex justify-center h-full items-center box-border">
    <div @click.stop="$emit('update', !value)">
      <div v-if="value">
        <i class="fa-light fa-square-check h-10 hover:h-12 text-green-400" />
      </div>
      <div v-else>
        <i class="fa-light fa-square h-10 hover:h-12 text-green-400" />
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['update'])
defineProps({
  value: {
    type: Boolean,
    required: true
  }
})
</script>
