<script setup>
import { Doc } from '@/classes/Doc.js'
import GenericButton from '@/components/GenericButton.vue'
import Modal from '@/components/Modal.vue'
import TextInput from '@/components/TextInput.vue'
import { inject, ref } from 'vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const emit = defineEmits(['add-actions'])

const workspace = inject('workspace')

const editionOpen = ref(false)
const form = ref({
  content: props.doc.content,
  text_color: props.doc.settings?.text_color || '#ffffff',
  bg_color: props.doc.settings?.bg_color || '#1F2937',
})

const extraActions = [
  {
    action: 'edit',
    label: 'Edit',
    onClick() {
      editionOpen.value = true
    },
  },
]

emit('add-actions', extraActions)
</script>

<template>
  <div
    class="text-lg h-full p-4"
    :style="{ 'background-color': doc.settings?.bg_color, color: doc.settings?.text_color }"
  >
    {{ doc.content }}
    <Modal v-model:is-open="editionOpen">
      <template #body> </template>
    </Modal>
  </div>
</template>
