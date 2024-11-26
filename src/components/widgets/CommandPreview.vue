<script setup>
import { Doc } from '@/classes/Doc.js'
import { inject, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import HighlightEditor from '@/components/HighlightEditor.vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const workspace = inject('workspace')
let revision = ''

watch(() => props.doc.content, () => {
  if (props.doc._rev === revision) return
  richText.value = props.doc.content
})

const richText = ref(props.doc.content)

const updateDebounced = useDebounceFn(async (content) => {
  const { rev } = await workspace.updateDoc(props.doc, { content })
  revision = rev
}, 1000)

</script>

<template>
  <div class="flex items-center bg-gray-800 rounded p-1">
    <i class="fa-solid fa-terminal h-3 text-gray-400 mr-2" />
    <HighlightEditor
      v-model="richText"
      class="w-full break-words"
      @input="updateDebounced"
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
