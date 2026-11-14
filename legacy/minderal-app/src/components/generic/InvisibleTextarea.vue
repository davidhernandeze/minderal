<script setup>
import RichTextEditor from '@/components/generic/RichTextEditor.vue'

const value = defineModel({ type: String })
</script>
<template>
  <RichTextEditor
    v-bind="$attrs"
    v-model="value"
    class="resize-none bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-hidden p-0"
  />
</template>
