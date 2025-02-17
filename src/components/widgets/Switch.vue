<script setup>
import { Doc } from '@/classes/Doc.js'
import { inject, ref, watch } from 'vue'
import { ToggleSwitch } from 'primevue'

defineEmits(['update'])
const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const workspace = inject('workspace')
const checked = ref(props.doc.content)

watch(checked, async (value) => {
  await workspace.updateDoc(props.doc, { content: value })
})
</script>

<template>
  <div class="flex justify-center h-full items-center scale-150">
    <ToggleSwitch v-model="checked"/>
  </div>
</template>

<style scoped>

</style>
