<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import type { Workspace } from '@/domain'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import type { WidgetTypeTemplateEntry } from '@/domain/interfaces/WidgetTypeDocStructure'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import IconSelector from './IconSelector.vue'
import AbstractInput from './AbstractInput.vue'

const props = defineProps<{
  visible: boolean
  workspace: Workspace
  initialLabel?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  created: [typeId: string]
}>()

const label = ref(props.initialLabel ?? '')
const selectedPrimitiveKey = ref('list')
const selectedIcon = ref('plus-circle-fill')
const settings = ref<Record<string, unknown>>({})
const templateEntries = ref<WidgetTypeTemplateEntry[]>([])

const primitiveTypeSelectorRef = ref()
const iconSelectorRef = ref()

// Reset form when modal opens
watch(
  () => props.visible,
  (v) => {
    if (v) {
      label.value = props.initialLabel ?? ''
      selectedPrimitiveKey.value = 'list'
      selectedIcon.value = 'plus-circle-fill'
      settings.value = {}
      templateEntries.value = []
    }
  }
)

const primitiveTypes = computed(() =>
  props.workspace.getWidgetTypes().filter((t) => !t.isCustom)
)

const allTypes = computed(() => props.workspace.getWidgetTypes())

const selectedPrimitive = computed(
  () => primitiveTypes.value.find((t) => t.key === selectedPrimitiveKey.value) ?? primitiveTypes.value[0]
)

// Get available settings from a temp widget of the selected primitive type
const availableSettings = ref<Array<{ name: string; type: string; label: string }>>([])

watch(
  () => selectedPrimitiveKey.value,
  async (key) => {
    settings.value = {}
    try {
      const widget = await props.workspace.widgetFactory.createFromRequest({
        parent_id: '',
        widget: key,
        content: ''
      })
      availableSettings.value = widget.getParentableSettings()
    } catch {
      availableSettings.value = []
    }
  },
  { immediate: true }
)

// Check if selected primitive is parentable
const isPrimitivParentable = ref(false)

watch(
  () => selectedPrimitiveKey.value,
  async (key) => {
    templateEntries.value = []
    try {
      const widget = await props.workspace.widgetFactory.createFromRequest({
        parent_id: '',
        widget: key,
        content: ''
      })
      isPrimitivParentable.value = widget.parentable
    } catch {
      isPrimitivParentable.value = false
    }
  },
  { immediate: true }
)

function addTemplateEntry() {
  templateEntries.value.push({ widget_type: 'text', name: '' })
}

function removeTemplateEntry(index: number) {
  templateEntries.value.splice(index, 1)
}

function handleTemplateTypeSelect(index: number, key: string) {
  templateEntries.value[index].widget_type = key
}

const canSubmit = computed(() => label.value.trim().length > 0)

async function onSubmit() {
  if (!canSubmit.value) return

  const settingsToSave = availableSettings.value.length > 0 ? { ...settings.value } : undefined
  const templateToSave =
    isPrimitivParentable.value && templateEntries.value.length > 0
      ? templateEntries.value.map((e) => ({
          widget_type: e.widget_type,
          name: e.name || undefined
        }))
      : undefined

  const doc = await props.workspace.db.createWidgetTypeDoc(
    label.value.trim(),
    selectedIcon.value,
    selectedPrimitiveKey.value,
    settingsToSave,
    templateToSave
  )

  await props.workspace.reloadWidgetTypes()
  emit('created', doc._id)
  emit('update:visible', false)
}

function getTypeDefinition(key: string): WidgetTypeDefinition | undefined {
  return allTypes.value.find((t) => t.key === key)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Create Custom Widget Type"
    :style="{ width: '32rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="flex flex-col gap-5">
      <!-- Header sentence: Create a custom widget {label} extending from {primitive} using {icon} icon -->
      <div class="flex flex-wrap items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
        <span>Create a custom widget</span>
        <InputText
          v-model="label"
          placeholder="Label"
          size="small"
          class="!w-32"
          @keydown.stop
        />
        <span>extending from</span>
        <Button
          :icon="selectedPrimitive?.icon"
          :label="selectedPrimitive?.label ?? 'Select'"
          variant="outlined"
          size="small"
          @click="(e) => primitiveTypeSelectorRef?.toggle(e)"
        />
        <WidgetTypeSelector
          ref="primitiveTypeSelectorRef"
          :types="primitiveTypes"
          :selected-key="selectedPrimitiveKey"
          @select="(key) => (selectedPrimitiveKey = key)"
        />
        <span>using</span>
        <Button
          :icon="`bi bi-${selectedIcon}`"
          variant="outlined"
          size="small"
          @click="(e) => iconSelectorRef?.toggle(e)"
        />
        <IconSelector
          ref="iconSelectorRef"
          :selected-key="selectedIcon"
          @select="(key) => (selectedIcon = key)"
        />
        <span>icon</span>
      </div>

      <!-- Settings section -->
      <div v-if="availableSettings.length > 0" class="flex flex-col gap-3">
        <h4 class="text-sm font-medium text-surface-500 dark:text-surface-400">Settings</h4>
        <div v-for="setting in availableSettings" :key="setting.name" class="flex flex-col gap-1">
          <label :for="setting.name" class="text-xs text-surface-500">{{ setting.label }}</label>
          <AbstractInput
            :field="{ name: setting.name, type: setting.type as any, label: setting.label }"
            :model-value="settings[setting.name]"
            :widget-types="allTypes"
            @update:model-value="(v) => (settings[setting.name] = v)"
          />
        </div>
      </div>

      <!-- Template section -->
      <div v-if="isPrimitivParentable" class="flex flex-col gap-3">
        <h4 class="text-sm font-medium text-surface-500 dark:text-surface-400">Template</h4>
        <p class="text-xs text-surface-400">
          Child widgets to auto-create when a widget of this type is created.
        </p>
        <div
          v-for="(entry, index) in templateEntries"
          :key="index"
          class="flex items-center gap-2"
        >
          <span class="text-sm text-surface-500">Including a</span>
          <Button
            :icon="getTypeDefinition(entry.widget_type)?.icon"
            :label="getTypeDefinition(entry.widget_type)?.label ?? 'Select'"
            variant="outlined"
            size="small"
            @click="(e) => $refs[`templateTypeSelector${index}`]?.[0]?.toggle(e)"
          />
          <WidgetTypeSelector
            :ref="`templateTypeSelector${index}`"
            :types="allTypes"
            :selected-key="entry.widget_type"
            @select="(key) => handleTemplateTypeSelect(index, key)"
          />

          <template v-if="getTypeDefinition(entry.widget_type)?.showNameSelector">
            <span class="text-sm text-surface-500">as</span>
            <InputText
              v-model="entry.name"
              placeholder="name"
              size="small"
              class="!w-24"
              @keydown.stop
            />
          </template>

          <Button
            icon="bi bi-x"
            variant="text"
            severity="danger"
            size="small"
            @click="removeTemplateEntry(index)"
          />
        </div>
        <Button
          icon="bi bi-plus"
          label="Add child"
          variant="text"
          size="small"
          class="self-start"
          @click="addTemplateEntry"
        />
      </div>

      <!-- Submit -->
      <div class="flex justify-end gap-2 pt-2">
        <Button
          label="Cancel"
          variant="text"
          size="small"
          @click="emit('update:visible', false)"
        />
        <Button
          label="Create"
          size="small"
          :disabled="!canSubmit"
          @click="onSubmit"
        />
      </div>
    </div>
  </Dialog>
</template>
