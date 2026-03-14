<script setup lang="ts">
import { ref, watch } from 'vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type ColorWidget from '@/domain/widgets/ColorWidget'

const { widget } = defineProps<{ widget: ColorWidget }>()

const color = useReactiveObjectProp<ColorWidget, string>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)

// Local copy for live preview while dragging the color picker
const localColor = ref(color.value)
watch(color, (v) => (localColor.value = v))

function onInput(e: Event) {
  localColor.value = (e.target as HTMLInputElement).value
}

async function onChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  localColor.value = value
  await widget.updateContent(value)
}
</script>

<template>
  <div class="relative w-full h-full cursor-pointer" title="Click to change color">
    <div
      class="w-full h-full rounded-full shadow-inner transition-transform hover:scale-110"
      :style="{ backgroundColor: localColor }"
    />
    <input
      type="color"
      :value="localColor"
      class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      @input="onInput"
      @change="onChange"
    />
  </div>
</template>
