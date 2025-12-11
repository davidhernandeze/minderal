<script setup lang="ts">
import { Message, InputText, Button, Textarea } from 'primevue'
import { onMounted, ref } from 'vue'
import { FormStructure } from '@/domain/interfaces/FormStructure'

const { formStructure } = defineProps<{
  formStructure: FormStructure
}>()
const form = ref({})

const emits = defineEmits(['submit'])

function submit() {
  emits('submit', form.value)
}

onMounted(() => {
  for (const field of formStructure.fields) {
    form.value[field.name] = formStructure[field.name]?.default ?? ''
  }
})
</script>

<template>
  <form class="text-gray-200 text-xl" @submit.prevent="submit">
    <div v-for="field in formStructure.fields" :key="field.name" class="mt-4">
      <div class="flex flex-col gap-2">
        <label class="text-sm" :for="String(field.name)">{{ field.label }}</label>

        <InputText
          v-if="field.type === 'text'"
          :id="String(field.name)"
          v-model="form[field.name]"
          :aria-describedby="field.label + '-desc'"
        />

        <Textarea v-else-if="field.type === 'textarea'" v-model="form[field.name]" />

        <Message size="small" severity="secondary" variant="simple"></Message>
      </div>
    </div>

    <Button class="mt-4" label="Submit" @click="submit" />
  </form>
</template>
