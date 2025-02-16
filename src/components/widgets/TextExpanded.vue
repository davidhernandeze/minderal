<script setup>
import { inject } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { useDoc } from '@/composables/useDoc.js'
import { toRef } from '@vueuse/core'
import InvisibleInput from '@/components/InvisibleInput.vue'

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
  <InvisibleInput
    v-model="content"
    class="w-full h-full break-words pr-2"
    @focusout="exitEdition"
    @focusin="startEdition"
  />
</template>
