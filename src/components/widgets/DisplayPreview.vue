<script setup>
import { Doc } from '@/classes/Doc.js'
import GenericButton from '@/components/GenericButton.vue'
import Modal from '@/components/Modal.vue'
import TextInput from '@/components/TextInput.vue'
import { inject, ref } from 'vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const emit = defineEmits(['add-actions'])

const workspace = inject('workspace')

const editionOpen = ref(false)
const form = ref({
  display: props.doc.value,
  text_color: props.doc.settings?.text_color || '#ffffff',
  bg_color: props.doc.settings?.bg_color || '#1F2937'
})

const extraActions = [{
  action: 'edit',
  label: 'Edit',
  onClick () {
    editionOpen.value = true
  }
}]

emit('add-actions', extraActions)

function update () {
  const updatedValue = {
    content: form.value.content,
    settings: {
      bg_color: form.value.bg_color,
      text_color: form.value.text_color
    }
  }
  workspace.updateDoc(props.doc, { ...updatedValue })
  editionOpen.value = false
}
</script>

<template>
  <div class="text-xs">
    {{ doc.content }}

    <Modal
      v-model:is-open="editionOpen"
    >
      <template #body>
        <form
          class="text-gray-200 text-xl "
          @submit.prevent="update"
        >
          <h1 class="mb-1">
            Edit Display
          </h1>
          <div class="text-sm">
            You can customize how the widget is displayed
          </div>
          <TextInput
            v-model:value="form.content"
            label="Display Text"
            type="text"
            class="my-3 w-full"
          />
          <div class="my-4 flex items-center gap-3 text-base">
            <input
              id="text-color"
              v-model="form.text_color"
              type="color"
            >
            <label for="text-color">Text Color</label>
          </div>
          <div class="my-4 flex items-center gap-3 text-base">
            <input
              id="color"
              v-model="form.bg_color"
              type="color"
            >
            <label for="color">Background Color</label>
          </div>
          <GenericButton
            class="bg-indigo-600 hover:bg-indigo-500 mt-6"
            type="submit"
          >
            Update
          </GenericButton>
        </form>
      </template>
    </Modal>
  </div>
</template>
