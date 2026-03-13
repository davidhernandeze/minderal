<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import type { WidgetTypeDefinition } from '@/domain/widgets'

const props = defineProps<{
  types: WidgetTypeDefinition[]
  selectedKey: string
}>()

const emit = defineEmits<{
  select: [key: string]
  open: []
  close: []
}>()

const popoverRef = ref()
const searchQuery = ref('')
const searchInputRef = ref()

const filteredTypes = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return q ? props.types.filter((t) => t.label.toLowerCase().includes(q)) : props.types
})

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

function onShow() {
  emit('open')
  nextTick(() => searchInputRef.value?.$el?.focus())
}

function onHide() {
  emit('close')
  searchQuery.value = ''
}

function selectType(key: string) {
  emit('select', key)
  popoverRef.value?.hide()
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popoverRef" @show="onShow" @hide="onHide">
    <div class="flex flex-col gap-2" style="width: 12rem">
      <InputText
        ref="searchInputRef"
        v-model="searchQuery"
        placeholder="Search types..."
        size="small"
        fluid
        @keydown.stop
        @keydown.enter.prevent="filteredTypes[0] && selectType(filteredTypes[0].key)"
      />
      <ul class="flex flex-col">
        <li
          v-for="type in filteredTypes"
          :key="type.key"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
          :class="
            type.key === selectedKey
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-surface-100 dark:hover:bg-surface-700'
          "
          @mousedown.prevent="selectType(type.key)"
        >
          <i :class="type.icon" class="text-sm w-4" />
          <span class="text-sm">{{ type.label }}</span>
        </li>
        <li v-if="filteredTypes.length === 0" class="text-xs text-surface-400 px-2 py-1.5">
          No results
        </li>
      </ul>
    </div>
  </Popover>
</template>
