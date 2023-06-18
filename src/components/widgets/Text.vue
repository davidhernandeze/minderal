<template>
  <div class="text-xs">
    {{ value }}
  </div>
</template>

<script setup>
defineProps({
  value: {
    type: String,
    required: true
  }
})
</script>
