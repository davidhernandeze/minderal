<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InvisibleInput from '@/components/InvisibleInput.vue'
import WidgetMenu from '@/components/WidgetMenu.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Widget } from '@/domain/Widget'

const { widget } = defineProps<{
  widget: Widget
}>()

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')
const isEditingName = ref(false)
const menuEvent = ref<Event | null>(null)

const icon = computed(() => widget.getWorkspace().widgetTypes.get(widget.key)?.icon ?? '')

function startNameEdit() {
  isEditingName.value = true
}

async function endNameEdit() {
  if (!isEditingName.value) return
  isEditingName.value = false
  await widget.rename(widgetName.value)
}

function handleNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    ;(e.target as HTMLElement).blur()
  }
}
</script>

<template>
  <div
    class="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-default"
  >
    <!-- Widget icon -->
    <i :class="icon" class="text-base text-surface-400 shrink-0" />

    <!-- Name -->
    <InvisibleInput
      v-model:value="widgetName"
      class="flex-1 text-sm min-w-0 cursor-text"
      @focus="startNameEdit"
      @blur="endNameEdit"
      @keydown="handleNameKeydown"
    />

    <!-- Navigate button for expandable widgets -->
    <Button
      v-if="widget.expandable"
      icon="bi bi-chevron-right"
      variant="text"
      size="small"
      class="!p-1 shrink-0"
      @click="widget.openInWorkspace()"
    />

    <!-- Menu trigger -->
    <Button
      icon="bi bi-three-dots"
      variant="text"
      size="small"
      class="!p-1 shrink-0"
      @click="(e) => (menuEvent = e)"
    />
    <WidgetMenu v-model:event="menuEvent" :widget="widget" />
  </div>
</template>
