<template>
  <div class="bg-gray-600 h-32 hover:bg-gray-800 rounded overflow-hidden relative cursor-pointer p-2 shadow-md">
    <div class="flex justify-start items-center text-gray-400 mb-2">
      <i
        :class="icon"
        class="h-3"
      />
      <div class="text-xs ml-2">
        {{ document.name }}
      </div>
    </div>
    <Widget :value="document.value" />
  </div>
</template>
<script setup>
import { defineAsyncComponent } from 'vue'
import { widgets } from '@/enums/widgets.js'

const props = defineProps({
  document: {
    type: Object,
    required: true
  }
})
const icon = widgets[props.document.type].icon
const Widget = defineAsyncComponent(() => {
  const componentName = props.document.type.charAt(0).toUpperCase() + props.document.type.slice(1)
  return import(`./widgets/${componentName}.vue`)
})
</script>
