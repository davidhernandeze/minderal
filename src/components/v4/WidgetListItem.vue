<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InvisibleInput from '@/components/InvisibleInput.vue'
import WidgetMenu from '@/components/WidgetMenu.vue'
import WidgetInlinePreview from './WidgetInlinePreview.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Widget } from '@/domain/Widget'

const { widget } = defineProps<{ widget: Widget }>()

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
  if (e.key === 'Enter') (e.target as HTMLElement).blur()
}
</script>

<template>
  <div
    class="group flex items-center gap-3 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:shadow-sm transition-colors cursor-default"
  >
    <!-- Menu -->
    <Button
      icon="bi bi-three-dots-vertical"
      variant="text"
      size="small"
      class="!p-1 shrink-0"
      @click="(e) => (menuEvent = e)"
    />
    <WidgetMenu v-model:event="menuEvent" :widget="widget" />

    <!-- Icon -->
    <i :class="icon" class="text-base text-surface-400 shrink-0 self-center" />

    <!-- Content: name descriptor + content preview -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Name (small descriptor, editable) -->
      <InvisibleInput
        v-model:value="widgetName"
        class="text-[0.55rem] tracking-widest uppercase font-semibold text-surface-400 min-w-0 truncate leading-none mb-0.5"
        placeholder="_"
        @focus="startNameEdit"
        @blur="endNameEdit"
        @keydown="handleNameKeydown"
      />

      <!-- Content preview row -->
      <div class="flex justify-start gap-2 min-w-0">
        <WidgetInlinePreview :widget="widget" />
      </div>
    </div>
  </div>
</template>
