<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import type { Workspace } from '@/domain'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import { useWidgetRelations } from '@/composables/useWidgetRelations'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import RelationSelector from './RelationSelector.vue'

const props = defineProps<{
  workspace: Workspace
  defaultTypeKey?: string
}>()

const emit = defineEmits<{
  saved: []
  discard: []
}>()

const { sortByUsage, recordUsage } = useWidgetUsage()
const { recordRelation } = useWidgetRelations()

const allTypes = computed(() => props.workspace.getWidgetTypes())
const sortedTypes = computed(() => sortByUsage(allTypes.value))

const resolvedDefault = computed(() => {
  const key = props.defaultTypeKey ?? 'text'
  return allTypes.value.find((t) => t.key === key) ?? sortedTypes.value[0]
})

const DEFAULT_RELATION = 'item'

const selectedType = ref<WidgetTypeDefinition>(resolvedDefault.value)
const selectedRelation = ref<string>(DEFAULT_RELATION)

const ghostName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const typeSelectorRef = ref()
const relationSelectorRef = ref()
const isAnySelectorOpen = ref(false)
const isCommitting = ref(false)

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

function handleTypeSelect(key: string) {
  const found = allTypes.value.find((t) => t.key === key)
  if (found) selectedType.value = found
  nextTick(() => nameInputRef.value?.focus())
}

function handleRelationSelect(relation: string | null) {
  selectedRelation.value = relation ?? DEFAULT_RELATION
  nextTick(() => nameInputRef.value?.focus())
}

async function commit() {
  if (isCommitting.value || isAnySelectorOpen.value) return
  isCommitting.value = true

  const name = ghostName.value.trim()
  if (!name) {
    isCommitting.value = false
    emit('discard')
    return
  }

  const relation =
    selectedRelation.value && selectedRelation.value !== DEFAULT_RELATION
      ? selectedRelation.value
      : null

  const widget = await props.workspace.widgetFactory.createFromRequest({
    parent_id: props.workspace.docId,
    widget: selectedType.value.key,
    name,
    content: '',
    relation
  })
  await widget.save()
  recordUsage(selectedType.value.key)
  if (relation) recordRelation(relation)
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
    class="flex flex-col gap-2 px-3 py-3 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 bg-surface-50/30 dark:bg-surface-800/30"
  >
    <!-- Top label row: "Add a [Type] [Relation]" -->
    <div class="flex items-center gap-1 text-surface-400 dark:text-surface-500">
      <span class="text-sm">Add a</span>

      <!-- Type button -->
      <Button
        :icon="selectedType?.icon"
        :label="selectedType?.label"
        variant="text"
        size="small"
        class="!px-1.5 !py-0.5 text-primary font-medium"
        @click="(e) => typeSelectorRef?.toggle(e)"
      />
      <WidgetTypeSelector
        ref="typeSelectorRef"
        :types="sortedTypes"
        :selected-key="selectedType?.key ?? ''"
        @select="handleTypeSelect"
        @open="isAnySelectorOpen = true"
        @close="isAnySelectorOpen = false"
      />

      <!-- Relation button -->
      <Button
        :label="selectedRelation ?? '···'"
        :icon="selectedRelation ? 'bi bi-tag' : 'bi bi-plus'"
        variant="text"
        size="small"
        class="!px-1.5 !py-0.5 font-medium"
        :class="selectedRelation ? 'text-primary' : 'text-surface-400 dark:text-surface-500'"
        @click="(e) => relationSelectorRef?.toggle(e)"
      />
      <RelationSelector
        ref="relationSelectorRef"
        :selected-relation="selectedRelation"
        @select="handleRelationSelect"
        @open="isAnySelectorOpen = true"
        @close="isAnySelectorOpen = false"
      />
    </div>

    <!-- Name input row -->
    <div class="flex items-center gap-2">
      <input
        ref="nameInputRef"
        v-model="ghostName"
        class="flex-1 bg-transparent border-none outline-none text-sm placeholder-surface-400 dark:placeholder-surface-500 min-w-0"
        placeholder="Name your item..."
        @keydown="handleKeydown"
      />
      <span class="text-xs text-surface-400 dark:text-surface-500 shrink-0 hidden sm:block">
        Enter ↵
      </span>
    </div>
  </div>
</template>
