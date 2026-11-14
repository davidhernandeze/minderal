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
  create: [label: string]
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

const hasExactMatch = computed(() =>
  filteredTypes.value.some(
    (t) => t.label.toLowerCase() === searchQuery.value.trim().toLowerCase()
  )
)

const showCreate = computed(() => searchQuery.value.trim() && !hasExactMatch.value)

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

function createType() {
  const label = searchQuery.value.trim()
  if (label) {
    emit('create', label)
    popoverRef.value?.hide()
  }
}

function handleSearchKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Enter') {
    if (filteredTypes.value.length > 0 && !showCreate.value) {
      selectType(filteredTypes.value[0].key)
    } else if (showCreate.value) {
      createType()
    }
  }
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
        @keydown="handleSearchKeydown"
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

        <!-- Create new -->
        <li
          v-if="showCreate"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-primary"
          @mousedown.prevent="createType"
        >
          <i class="bi bi-plus text-sm w-4" />
          <span class="text-sm">Create "{{ searchQuery.trim() }}"</span>
        </li>

        <li
          v-if="filteredTypes.length === 0 && !showCreate"
          class="text-xs text-surface-400 px-2 py-1.5"
        >
          No results
        </li>
      </ul>
    </div>
  </Popover>
</template>
