<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import type { Workspace } from '@/domain'
import type { Widget } from '@/domain/Widget'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import type { FormStructure } from '@/domain/interfaces/FormStructure'
import type { AllowedContentTypes } from '@/domain/interfaces/WidgetDocStructure'
import type { TagDocStructure } from '@/domain/interfaces/TagDocStructure'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import { useWidgetRelations } from '@/composables/useWidgetRelations'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import RelationSelector from './RelationSelector.vue'
import TagSelector from './TagSelector.vue'
import GeneralFormV4 from './GeneralFormV4.vue'
import CreateWidgetTypeModal from './CreateWidgetTypeModal.vue'

const props = defineProps<{
  workspace: Workspace
  defaultTypeKey?: string
  editWidget?: Widget
}>()

const emit = defineEmits<{
  saved: []
  discard: []
}>()

const { sortByUsage, recordUsage } = useWidgetUsage()
const { recordRelation } = useWidgetRelations()

const isEditMode = computed(() => !!props.editWidget)

const allTypes = computed(() => props.workspace.getWidgetTypes())
const sortedTypes = computed(() => sortByUsage(allTypes.value))

const resolvedDefault = computed(() => {
  if (props.editWidget) {
    return allTypes.value.find((t) => t.key === props.editWidget!.key) ?? sortedTypes.value[0]
  }
  const key = props.defaultTypeKey ?? 'text'
  return allTypes.value.find((t) => t.key === key) ?? sortedTypes.value[0]
})

const DEFAULT_RELATION = 'item'
const selectedType = ref<WidgetTypeDefinition>(resolvedDefault.value)
const selectedRelation = ref<string>(DEFAULT_RELATION)

const containerRef = ref<HTMLElement | null>(null)
const typeSelectorRef = ref()
const relationSelectorRef = ref()
const tagSelectorRef = ref()
const isAnySelectorOpen = ref(false)

const selectedTags = ref<string[]>(props.editWidget?.getTags() ?? [])
const availableTags = ref<TagDocStructure[]>([])

const createModalVisible = ref(false)
const createModalLabel = ref('')

function handleTypeCreate(label: string) {
  createModalLabel.value = label
  createModalVisible.value = true
}

function handleTypeCreated(typeId: string) {
  const found = allTypes.value.find((t) => t.key === typeId)
  if (found) selectedType.value = found
}

const pendingWidget = ref<Widget | null>(null)
const formStructure = ref<FormStructure>()
const initialValues = computed(() => props.editWidget?.getFormValues())

// In edit mode use the existing widget's form; in create mode recreate on type change
watch(
  () => selectedType.value,
  async (type) => {
    if (!type) return
    formStructure.value = null
    if (isEditMode.value) {
      formStructure.value = props.editWidget!.getFormStructure()
    } else {
      const widget: Widget = await props.workspace.widgetFactory.createFromRequest({
        parent_id: props.workspace.docId,
        widget: type.key,
        content: ''
      })
      pendingWidget.value = widget
      formStructure.value = widget.getFormStructure()
    }
  },
  { immediate: true }
)

function tagIdToLabel(id: string): string {
  return id.replace(/_/g, ' ')
}

function handleTagAdd(tagId: string) {
  if (!selectedTags.value.includes(tagId)) {
    selectedTags.value = [...selectedTags.value, tagId]
  }
}

function handleTagRemove(tagId: string) {
  selectedTags.value = selectedTags.value.filter((t) => t !== tagId)
}

onMounted(async () => {
  document.addEventListener('mousedown', onDocMousedown)
  availableTags.value = await props.workspace.db.getTagDocs()
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMousedown)
})

function isInsideOverlay(el: Element): boolean {
  return (
    !!el.closest('[data-pc-name="popover"]') ||
    !!el.closest('[data-pc-name="dialog"]') ||
    !!el.closest('.p-dialog-mask')
  )
}

function onDocMousedown(e: MouseEvent) {
  if (createModalVisible.value) return
  const target = e.target as Element
  if (!containerRef.value?.contains(target) && !isInsideOverlay(target)) {
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
  const valuesWithTags = { ...values, tags: selectedTags.value }

  if (isEditMode.value) {
    const widget = props.editWidget!
    if (typeof (widget as any).updateDocFromForm === 'function') {
      ;(widget as any).updateDocFromForm(valuesWithTags)
    }
    await widget.db.updateDoc(widget.doc)
    for (const tagId of selectedTags.value) {
      await props.workspace.db.createOrUpdateTagDoc(tagIdToLabel(tagId))
    }
    emit('saved')
    return
  }

  if (!pendingWidget.value) return

  const relation = selectedRelation.value !== DEFAULT_RELATION ? selectedRelation.value : null

  if (typeof (pendingWidget.value as any).updateDocFromForm === 'function') {
    ;(pendingWidget.value as any).updateDocFromForm({
      ...valuesWithTags,
      name: relation ?? values.name
    })
  }

  // Apply pre-configured settings from custom type
  if (selectedType.value.isCustom) {
    const typeDef = props.workspace.widgetTypes.get(selectedType.value.key)
    if (typeDef) {
      try {
        const typeDoc = await props.workspace.db.getDoc(selectedType.value.key)
        if (typeDoc.settings) {
          pendingWidget.value.doc.settings = {
            ...pendingWidget.value.doc.settings,
            ...(typeDoc.settings as Record<string, AllowedContentTypes>)
          }
        }
      } catch {
        // ignore
      }
    }
  }

  await pendingWidget.value.save()

  for (const tagId of selectedTags.value) {
    await props.workspace.db.createOrUpdateTagDoc(tagIdToLabel(tagId))
  }

  // Auto-create template children for custom types
  if (selectedType.value.isCustom) {
    await props.workspace.widgetFactory.createTemplateChildren(pendingWidget.value)
  }

  recordUsage(selectedType.value.key)
  if (relation) recordRelation(relation)
  emit('saved')
}
</script>

<template>
  <div
    ref="containerRef"
    class="v4-ui-chrome flex flex-col gap-1 px-3 pt-1 pb-3 rounded-lg border border-dashed border-surface-300 dark:border-surface-600 bg-surface-50/30 dark:bg-surface-800/30"
  >
    <!-- Tags row -->
    <div class="flex justify-between items-center gap-1.5 flex-wrap">
      <Tag
        v-for="tagId in selectedTags"
        :key="tagId"
        :value="tagIdToLabel(tagId)"
        severity="secondary"
        class="cursor-pointer !text-xs"
        @mousedown.prevent="handleTagRemove(tagId)"
      />
      <button
        class="cursor-pointer text-xs text-(--p-surface-500) hover:text-primary transition-colors flex items-center gap-0.5"
        @click="(e) => tagSelectorRef?.toggle(e)"
      >
        <i class="bi bi-hash text-xs" />
      </button>
      <TagSelector
        ref="tagSelectorRef"
        :selected-tags="selectedTags"
        :available-tags="availableTags"
        @add="handleTagAdd"
        @remove="handleTagRemove"
        @open="isAnySelectorOpen = true"
        @close="isAnySelectorOpen = false"
      />

      <button>
        <i
          class="bi bi-x text-surface-400 dark:text-surface-500 hover:text-primary transition-colors cursor-pointer"
          @click="emit('discard')"
        />
      </button>
    </div>

    <!-- Header: edit mode -->
    <div v-if="isEditMode" class="flex items-center gap-1 text-surface-400 dark:text-surface-500">
      <i :class="selectedType?.icon" class="text-sm" />
      <span class="text-sm font-medium text-surface-500 dark:text-surface-400"
        >Edit {{ selectedType?.label }}</span
      >
    </div>

    <!-- Header: create mode "Add a [Type] as [Relation]" -->
    <div v-else class="flex items-center gap-1 text-surface-400 dark:text-surface-500">
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
        @create="handleTypeCreate"
        @open="isAnySelectorOpen = true"
        @close="isAnySelectorOpen = false"
      />

      <span v-if="selectedType?.showNameSelector" class="text-sm">as</span>

      <Button
        v-if="selectedType?.showNameSelector"
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
      :submit-label="isEditMode ? `Save` : `Add ${selectedType?.label}`"
      :initial-values="initialValues"
      :widget-types="workspace.getWidgetTypes()"
      @submit="onFormSubmit"
    />

    <CreateWidgetTypeModal
      v-model:visible="createModalVisible"
      :workspace="workspace"
      :initial-label="createModalLabel"
      @created="handleTypeCreated"
    />
  </div>
</template>
