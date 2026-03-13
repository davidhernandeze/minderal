<script setup lang="ts">
import { ref, onMounted } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputNumber from 'primevue/inputnumber'
import Button from 'primevue/button'
import type { FormStructure } from '@/domain/interfaces/FormStructure'

const { formStructure, submitLabel = 'Add' } = defineProps<{
  formStructure: FormStructure
  submitLabel?: string
}>()

const emit = defineEmits<{ submit: [values: Record<string, unknown>] }>()

const form = ref<Record<string, unknown>>({})

onMounted(() => {
  for (const field of formStructure.fields) {
    if (field.type === 'color') {
      form.value[field.name] = field.default ?? '#6366f1'
    } else if (field.type === 'number') {
      form.value[field.name] = field.default ? Number(field.default) : 0
    } else if (field.type === 'checkbox') {
      form.value[field.name] = false
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
    <div
      v-for="field in formStructure.fields"
      :key="field.name"
      class="flex flex-col gap-1.5"
    >
      <label class="text-xs tracking-widest uppercase font-semibold text-surface-400 dark:text-surface-500">
        {{ field.label }}
      </label>

      <!-- Color -->
      <div v-if="field.type === 'color'" class="flex items-center gap-3">
        <div class="relative">
          <input
            :id="field.name"
            v-model="form[field.name]"
            type="color"
            class="w-10 h-10 rounded-lg cursor-pointer border-none bg-transparent p-0.5"
          />
        </div>
        <span class="text-sm font-mono text-surface-500 dark:text-surface-400 uppercase">
          {{ form[field.name] }}
        </span>
      </div>

      <!-- Text -->
      <InputText
        v-else-if="field.type === 'text'"
        :id="field.name"
        v-model="form[field.name]"
        size="small"
        fluid
        variant="filled"
        @keydown="handleKeydown"
      />

      <!-- Textarea -->
      <Textarea
        v-else-if="field.type === 'textarea'"
        :id="field.name"
        v-model="form[field.name]"
        size="small"
        fluid
        variant="filled"
        rows="3"
        auto-resize
      />

      <!-- Number -->
      <InputNumber
        v-else-if="field.type === 'number'"
        :input-id="field.name"
        v-model="form[field.name]"
        size="small"
        fluid
      />

      <!-- Checkbox -->
      <div v-else-if="field.type === 'checkbox'" class="flex items-center gap-2">
        <input :id="field.name" v-model="form[field.name]" type="checkbox" class="cursor-pointer" />
        <label :for="field.name" class="text-sm text-surface-500 cursor-pointer">{{ field.label }}</label>
      </div>
    </div>

    <Button
      :label="submitLabel"
      size="small"
      class="self-end mt-1"
      @click="submit"
    />
  </div>
</template>
