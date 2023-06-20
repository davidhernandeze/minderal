<template>
  <div class="text-xs">
    {{ document.value }}
  </div>
</template>

<script setup>
defineProps({
  document: {
    type: Object,
    required: true
  }
})
</script>
