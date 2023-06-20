<template>
  <div class="flex justify-center h-full items-center box-border">
    <div @click.stop="$emit('update', !document.value)">
      <div v-if="document.value">
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
  document: {
    type: Object,
    required: true
  }
})
</script>
