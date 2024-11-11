<script setup>
import { defineModel } from 'vue'

const value = defineModel('value')

</script>

<template>
  <input
    v-bind="$attrs"
    v-model="value"
    class="bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-none p-0"
  >
</template>
