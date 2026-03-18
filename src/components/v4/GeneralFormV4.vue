<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from 'primevue/button'
import type { FormStructure } from '@/domain/interfaces/FormStructure'
import type { WidgetTypeDefinition } from '@/domain/widgets'
import AbstractInput from './AbstractInput.vue'

const {
  formStructure,
  submitLabel = 'Add',
  widgetTypes
} = defineProps<{
  formStructure: FormStructure
  submitLabel?: string
  widgetTypes?: WidgetTypeDefinition[]
}>()

const emit = defineEmits<{ submit: [values: Record<string, unknown>] }>()

const form = ref<Record<string, unknown>>({})

onMounted(() => {
  for (const field of formStructure.fields) {
    if (field.type === 'color' || field.type === 'icon') {
      form.value[field.name] = field.default ?? ''
    } else if (field.type === 'number') {
      form.value[field.name] = field.default ? Number(field.default) : 0
    } else if (field.type === 'checkbox') {
      form.value[field.name] = false
    } else if (field.type === 'widget') {
      form.value[field.name] = widgetTypes?.[0]?.key ?? ''
    } else {
      form.value[field.name] = field.default ?? ''
    }
  }
})

function submit() {
  emit('submit', form.value)
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="flex flex-col gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
    <div v-for="field in formStructure.fields" :key="field.name" class="flex flex-col gap-1.5">
      <label
        class="text-xs tracking-widest uppercase font-semibold text-surface-400 dark:text-surface-500"
      >
        {{ field.label }}
      </label>

      <AbstractInput
        v-model="form[field.name]"
        :field="field"
        :widget-types="widgetTypes"
        @keydown="handleKeydown"
      />
    </div>

    <Button :label="submitLabel" size="small" class="self-end mt-1" @click="submit" />
  </div>
</template>
