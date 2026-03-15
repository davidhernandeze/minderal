<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import type { Workspace } from '@/domain'
import type { Widget } from '@/domain/Widget'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import type { FormStructure } from '@/domain/interfaces/FormStructure'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import { useWidgetRelations } from '@/composables/useWidgetRelations'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import RelationSelector from './RelationSelector.vue'
import GeneralFormV4 from './GeneralFormV4.vue'

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

const containerRef = ref<HTMLElement | null>(null)
const typeSelectorRef = ref()
const relationSelectorRef = ref()
const isAnySelectorOpen = ref(false)

const pendingWidget = ref<Widget | null>(null)
const formStructure = ref<FormStructure>()

// Recreate the pending widget and its form when type changes
watch(
  () => selectedType.value,
  async (type) => {
    if (!type) return
    const widget: Widget = await props.workspace.widgetFactory.createFromRequest({
      parent_id: props.workspace.docId,
      widget: type.key,
      content: ''
    })
    pendingWidget.value = widget
    formStructure.value = widget.getFormStructure()
  },
  { immediate: true }
)

onMounted(() => {
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
    emit('discard')
  }
}

function handleTypeSelect(key: string) {
  const found = allTypes.value.find((t) => t.key === key)
  if (found) selectedType.value = found
}

function handleRelationSelect(relation: string | null) {
  selectedRelation.value = relation ?? DEFAULT_RELATION
}

async function onFormSubmit(values: Record<string, unknown>) {
  if (!pendingWidget.value) return

  const relation = selectedRelation.value !== DEFAULT_RELATION ? selectedRelation.value : null

  if (typeof (pendingWidget.value as any).updateDocFromForm === 'function') {
    ;(pendingWidget.value as any).updateDocFromForm(values)
  }
  if (relation !== null) pendingWidget.value.doc.relation = relation

  await pendingWidget.value.save()
  recordUsage(selectedType.value.key)
  if (relation) recordRelation(relation)
  emit('saved')
}
</script>

<template>
  <div
    ref="containerRef"
    class="v4-ui-chrome flex flex-col gap-3 px-3 py-3 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 bg-surface-50/30 dark:bg-surface-800/30"
  >
    <!-- Header: "Add a [Type] as [Relation]" -->
    <div class="flex items-center gap-1 text-surface-400 dark:text-surface-500">
      <span class="text-sm">Add a</span>

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

      <span v-if="selectedType?.e" class="text-sm">as</span>

      <Button
        :label="selectedRelation"
        :icon="selectedRelation !== DEFAULT_RELATION ? 'bi bi-tag' : undefined"
        variant="text"
        size="small"
        class="!px-1.5 !py-0.5 font-medium"
        :class="
          selectedRelation !== DEFAULT_RELATION
            ? 'text-primary'
            : 'text-surface-400 dark:text-surface-500'
        "
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

    <!-- Form -->
    <GeneralFormV4
      v-if="formStructure"
      :key="selectedType?.key"
      :form-structure="formStructure"
      :submit-label="`Add ${selectedType?.label}`"
      @submit="onFormSubmit"
    />
  </div>
</template>
