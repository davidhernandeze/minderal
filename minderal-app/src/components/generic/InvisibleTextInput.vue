<script setup>
const value = defineModel({ type: String })
</script>
<template>
  <textarea
    v-bind="$attrs"
    v-model="value"
    style="field-sizing: content"
    class="resize-none bg-transparent focus:outline-none !outline-none p-0 border-none focus:ring-0"
  />
</template>
