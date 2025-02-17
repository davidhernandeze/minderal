<script setup>
import { inject } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { useDoc } from '@/composables/useDoc.js'
import InvisibleTextInput from '@/components/generic/InvisibleTextInput.vue'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const workspace = inject('workspace');
const doc = toRef(props, 'doc');
const { content, startEdition, exitEdition } = useDoc(workspace, doc)
</script>

<template>
  <div class="relative bg-gray-800 text-green-200 h-full p-2">
    <span class="absolute text-gray-400 mr-1 font-bold">></span>
    <InvisibleTextInput
      v-model="content"
      class="w-full h-full break-words px-4"
      @focusout="exitEdition"
      @focusin="startEdition"
    />
  </div>
</template>

<style scoped>
*::-webkit-scrollbar-track
{
  -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,0.3);
  border-radius: 10px;
  background-color: #F5F5F5;
}

*::-webkit-scrollbar
{
  width: 12px;
  background-color: #F5F5F5;
}

*::-webkit-scrollbar-thumb
{
  border-radius: 10px;
  -webkit-box-shadow: inset 0 0 6px rgba(0,0,0,.3);
  background-color: #D62929;
}
</style>
