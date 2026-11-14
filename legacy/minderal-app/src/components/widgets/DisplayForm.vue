<script setup>
import { ref } from 'vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'

const props = defineProps({
  doc: {
    type: Object,
    required: true
  }
})

const emits = defineEmits(['submit'])

const form = ref({
  _id: props.doc?._id || null,
  name: props.doc?.name || '',
  widget: 'display',
  content: props.doc?.content || '',
  settings: {
    bg_color: props.doc?.settings?.bg_color || '#1F2937',
    text_color: props.doc?.settings?.text_color || '#ffffff'
  }
})

function submit() {
  emits('submit', form.value)
}
</script>

<template>
  <form class="text-gray-200 text-xl" @submit.prevent="submit">
    <div class="text-sm">You can customize how the widget is displayed</div>
    <TextInput v-model="form.content" label="Display Text" type="text" class="my-3 w-full" />
    <div class="my-4 flex items-center gap-3 text-base">
      <input id="text-color" v-model="form.settings.text_color" type="color" />
      <label for="text-color">Text Color</label>
    </div>
    <div class="my-4 flex items-center gap-3 text-base">
      <input id="color" v-model="form.settings.bg_color" type="color" />
      <label for="color">Background Color</label>
    </div>
    <GenericButton class="bg-indigo-600 hover:bg-indigo-500 mt-6" type="submit">
      Update
    </GenericButton>
  </form>
</template>
