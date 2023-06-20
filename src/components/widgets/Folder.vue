<template>
  <div class="text-xs">
    {{ value }}
  </div>
</template>

<script setup>
defineProps({
  value: {
    type: null,
    required: true
  }
})
</script>
