<template>
  <div class="flex justify-center h-full items-start box-border">
    <div>
      <div @click.stop="$emit('update', !document.value)" class="flex justify-center">
        <div v-if="document.value">
          <i class="fa-light fa-square-check h-6 hover:h-7 text-green-400" />
        </div>
        <div v-else>
          <i class="fa-light fa-square h-6 hover:h-7 text-green-400" />
        </div>
      </div>
      <div class="text-sm">{{ document.name }}</div>
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
