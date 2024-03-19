<script setup>
import SwitchInput from '@/components/SwitchInput.vue'
import { Doc } from '@/classes/Doc.js'
import { inject } from 'vue'

defineEmits(['update'])
defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const workspace = inject('workspace')

</script>

<template>
  <div class="flex justify-center h-full items-start box-border">
    <div>
      <div
        class="flex justify-center h-7"
        @click.stop="workspace.updateDoc(doc, { content: !doc.content })"
      >
        <SwitchInput
          :model-value="doc.content"
        />
      </div>
      <div class="text-sm mt-1">
        {{ doc.name }}
      </div>
    </div>
  </div>
</template>
