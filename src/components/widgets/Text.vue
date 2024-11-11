<script setup>
import { Doc } from '@/classes/Doc.js'
import InvisibleTextarea from '@/components/InvisibleTextarea.vue'
import { inject, ref, watch } from 'vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const workspace = inject('workspace')

watch(() => props.doc.content, () => {
  content.value = props.doc.content
})

const content = ref(props.doc.content)

</script>

<template>
  <div class="h-full">
    <InvisibleTextarea
      v-model="content"
      class="text-xs overflow-y-auto w-full h-full break-all"
      @blur="workspace.updateDoc(props.doc, { content })"
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
