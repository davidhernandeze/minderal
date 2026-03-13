<script setup lang="ts">
import { ref, computed, watch, nextTick, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import type { Workspace } from '@/domain'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import type { Widget } from '@/domain/Widget'

const props = defineProps<{
  workspace: Workspace
}>()

const emit = defineEmits<{
  saved: []
  discard: []
}>()

const { sortByUsage, recordUsage } = useWidgetUsage()

const allTypes = computed(() => props.workspace.getWidgetTypes())
const sortedTypes = computed(() => sortByUsage(allTypes.value))

const selectedType = ref<WidgetTypeDefinition>(sortedTypes.value[0])
const ghostName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const typeSelectorRef = ref()
const isTypeSelectorOpen = ref(false)
const isCommitting = ref(false)

const ghostWidget = ref<Widget | null>(null)

const GhostPreviewComponent = computed(() => {
  const previewName = selectedType.value?.previewComponent
  if (!previewName) return null
  return defineAsyncComponent(() => import(`../widgets/preview/${previewName}.vue`))
})

watch(
  () => selectedType.value,
  async (type) => {
    if (!type) return
    ghostWidget.value = await props.workspace.widgetFactory.createFromRequest({
      parent_id: props.workspace.docId,
      widget: type.key,
      content: ''
    })
  },
  { immediate: true }
)

onMounted(() => {
  nextTick(() => nameInputRef.value?.focus())
  document.addEventListener('mousedown', onDocMousedown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
})

function isInsideAnyPopover(el: Element): boolean {
  return !!el.closest('[data-pc-name="popover"]')
}

function onDocMousedown(e: MouseEvent) {
  const target = e.target as Element
  if (!containerRef.value?.contains(target) && !isInsideAnyPopover(target)) {
    commit()
  }
}

function openTypeSelector(event: Event) {
  typeSelectorRef.value?.toggle(event)
}

function handleTypeSelect(key: string) {
  const found = allTypes.value.find((t) => t.key === key)
  if (found) selectedType.value = found
  nextTick(() => nameInputRef.value?.focus())
}

async function commit() {
  if (isCommitting.value || isTypeSelectorOpen.value) return
  isCommitting.value = true

  const name = ghostName.value.trim()
  if (!name) {
    isCommitting.value = false
    emit('discard')
    return
  }

  const widget = await props.workspace.widgetFactory.createFromRequest({
    parent_id: props.workspace.docId,
    widget: selectedType.value.key,
    name,
    content: ''
  })
  await widget.save()
  recordUsage(selectedType.value.key)
  emit('saved')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Escape') {
    emit('discard')
  }
}
</script>

<template>
  <div
    ref="containerRef"
    class="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 bg-surface-50/30 dark:bg-surface-800/30 opacity-80 hover:opacity-100 transition-opacity"
  >
    <!-- Type selector button -->
    <Button
      :icon="selectedType?.icon"
      :label="selectedType?.label"
      variant="text"
      size="small"
      class="shrink-0 !px-2 !py-1 gap-1.5 text-primary font-medium"
      @click="openTypeSelector"
    />
    <WidgetTypeSelector
      ref="typeSelectorRef"
      :types="sortedTypes"
      :selected-key="selectedType?.key ?? ''"
      @select="handleTypeSelect"
      @open="isTypeSelectorOpen = true"
      @close="isTypeSelectorOpen = false"
    />

    <!-- Divider -->
    <div class="w-px h-4 bg-surface-200 dark:bg-surface-700 shrink-0" />

    <!-- Name input -->
    <input
      ref="nameInputRef"
      v-model="ghostName"
      class="flex-1 bg-transparent border-none outline-none text-sm placeholder-surface-400 dark:placeholder-surface-500 min-w-0"
      placeholder="Paste, write, or drag..."
      @keydown="handleKeydown"
    />

    <!-- Hint -->
    <span class="text-xs text-surface-400 dark:text-surface-500 shrink-0 hidden sm:block">
      Enter ↵
    </span>
  </div>
</template>
