<script setup lang="ts">
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type ColorWidget from '@/domain/widgets/ColorWidget'

const { widget } = defineProps<{ widget: ColorWidget }>()

const color = useReactiveObjectProp<ColorWidget, string>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)
</script>

<template>
  <div class="flex items-center gap-3 h-full">
    <div
      class="w-10 h-10 rounded-lg shrink-0 shadow-inner"
      :style="{ backgroundColor: color }"
    />
    <span class="text-sm font-mono text-surface-500 dark:text-surface-400 uppercase">
      {{ color }}
    </span>
  </div>
</template>
