<script setup>
import { inject } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { useDoc } from '@/composables/useDoc.js'
import InvisibleTextInput from '@/components/generic/InvisibleTextInput.vue'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const workspace = inject('workspace')
const doc = toRef(props, 'doc')
const { content, startEdition, exitEdition } = useDoc(workspace, doc)
</script>

<template>
  <InvisibleTextInput
    v-model="content"
    class="w-full h-full break-words pr-2"
    @focusout="exitEdition"
    @focusin="startEdition"
  />
</template>

<style scoped>
*::-webkit-scrollbar-track {
  -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
  border-radius: 10px;
  background-color: #f5f5f5;
}

*::-webkit-scrollbar {
  width: 12px;
  background-color: #f5f5f5;
}

*::-webkit-scrollbar-thumb {
  border-radius: 10px;
  -webkit-box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
  background-color: #d62929;
}
</style>
