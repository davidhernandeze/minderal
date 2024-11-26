<script setup>
import { defineModel } from 'vue'

const value = defineModel('value')
const el = defineModel('el')

</script>

<template>
  <input
    :ref="el"
    v-bind="$attrs"
    v-model="value"
    class="bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-none p-0 outline-none focus:border-transparent focus:ring-0"
  >
</template>
