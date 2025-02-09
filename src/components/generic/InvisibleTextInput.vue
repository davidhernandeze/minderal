<script setup>
import { defineModel } from 'vue'

const value = defineModel()

</script>
<template>
  <textarea
    v-bind="$attrs"
    v-model="value"
    class="resize-none bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-hidden p-0"
  />
</template>
