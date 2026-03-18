<script setup lang="ts">
import { ref, computed } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import type { FieldStructure } from '@/domain/interfaces/FormStructure'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import WidgetTypeSelector from './WidgetTypeSelector.vue'

const props = defineProps<{
  field: FieldStructure
  modelValue: unknown
  widgetTypes?: WidgetTypeDefinition[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: unknown]
  keydown: [event: KeyboardEvent]
}>()

const typeSelectorRef = ref()

const selectedWidgetType = computed(
  () => props.widgetTypes?.find((t) => t.key === props.modelValue) ?? props.widgetTypes?.[0]
)

function handleWidgetSelect(key: string) {
  emit('update:modelValue', key)
}
</script>

<template>
  <!-- Color -->
  <div v-if="field.type === 'color'" class="flex items-center gap-3">
    <input
      :id="field.name"
      :value="modelValue"
      type="color"
      class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent p-0.5"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span class="text-sm font-mono text-surface-500 dark:text-surface-400 uppercase">
      {{ modelValue }}
    </span>
  </div>

  <!-- Text -->
  <InputText
    v-else-if="field.type === 'text'"
    :id="field.name"
    :model-value="modelValue as string"
    size="small"
    fluid
    variant="filled"
    @update:model-value="emit('update:modelValue', $event)"
    @keydown="emit('keydown', $event)"
  />

  <!-- Textarea -->
  <Textarea
    v-else-if="field.type === 'textarea'"
    :id="field.name"
    :model-value="modelValue as string"
    size="small"
    fluid
    variant="filled"
    rows="3"
    auto-resize
    @update:model-value="emit('update:modelValue', $event)"
  />

  <!-- Number -->
  <InputNumber
    v-else-if="field.type === 'number'"
    :input-id="field.name"
    :model-value="modelValue as number"
    size="small"
    fluid
    @update:model-value="emit('update:modelValue', $event)"
  />

  <!-- Checkbox -->
  <div v-else-if="field.type === 'checkbox'" class="flex items-center gap-2">
    <input
      :id="field.name"
      :checked="modelValue as boolean"
      type="checkbox"
      class="cursor-pointer"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <label :for="field.name" class="text-sm text-surface-500 cursor-pointer">{{
      field.label
    }}</label>
  </div>

  <!-- Widget type selector -->
  <div v-else-if="field.type === 'widget'" class="flex items-center gap-2">
    <Button
      :icon="selectedWidgetType?.icon"
      :label="selectedWidgetType?.label ?? 'Select type'"
      variant="outlined"
      size="small"
      @click="(e) => typeSelectorRef?.toggle(e)"
    />
    <WidgetTypeSelector
      ref="typeSelectorRef"
      :types="widgetTypes ?? []"
      :selected-key="(modelValue as string) ?? ''"
      @select="handleWidgetSelect"
    />
  </div>
</template>
