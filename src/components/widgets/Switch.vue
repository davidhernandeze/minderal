<script setup>
import { Doc } from '@/classes/Doc.js'
import { inject } from 'vue'
import { ToggleSwitch } from 'primevue'
import { useDoc } from '@/composables/useDoc.js'
import { toRef } from '@vueuse/core'

defineEmits(['update'])
const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const workspace = inject('workspace')
const { content, updateContent } = useDoc(workspace, toRef(props, 'doc'))

async function switchValue() {
  await updateContent()
}
</script>

<template>
  <div class="flex justify-center h-full items-center">
    <ToggleSwitch pt:root:class="scale-200" v-model="content" @change="switchValue" />
  </div>
</template>

<style scoped></style>
