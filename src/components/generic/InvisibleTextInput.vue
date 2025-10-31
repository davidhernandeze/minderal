<script setup>
const value = defineModel({ type: String })
</script>
<template>
  <textarea
    v-bind="$attrs"
    v-model="value"
    class="resize-none bg-transparent border-none focus:outline-none !outline-none p-0 border-none focus:ring-0"
  />
</template>
