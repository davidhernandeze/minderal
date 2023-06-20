<template>
  <div
    class="flex flex-col bg-gray-600 h-28 rounded overflow-hidden relative cursor-pointer p-2 shadow-md hover:border hover:border-gray-500"
    @click="clickAction"
  >
    <div class="flex justify-start items-center text-gray-400 mb-2">
      <i
        :class="icon"
        class="h-3"
      />
      <div class="text-xs ml-2">
        {{ document.name }}
      </div>
    </div>
    <div class="flex-1">
      <Widget
        :value="document.value"
        @update="(value) => $emit('update', value)"
      />
    </div>
  </div>
</template>
<script setup>
import { defineAsyncComponent } from 'vue'
import { widgets } from '@/enums/widgets.js'
const emits = defineEmits(['update', 'navigate'])
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

function clickAction () {
  if (props.document.type === 'folder') {
    emits('navigate', props.document._id)
  }
}
</script>
