<template>
  <div class="text-xs">
    {{ document.value }}
  </div>
</template>

<script setup>
defineProps({
  document: {
    type: String,
    required: true
  }
})
</script>
