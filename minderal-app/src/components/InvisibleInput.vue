<script setup>
const value = defineModel('value', { type: String })
const el = defineModel('el', { type: String })
</script>

<template>
  <input
    :ref="el"
    v-bind="$attrs"
    v-model="value"
    class="bg-transparent border-none focus:outline-hidden p-0 outline-hidden focus:border-transparent focus:ring-0"
  />
</template>
