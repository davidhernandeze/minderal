<script setup>
const value = defineModel()

</script>
<template>
  <textarea
    v-bind="$attrs"
    v-model="value"
    class="resize-none bg-transparent border-none focus:outline-hidden p-0"
  />
</template>
