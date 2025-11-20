<script setup lang="ts">
import InvisibleTextInput from '@/components/generic/InvisibleTextInput.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import TextWidget from '@/domain/widgets/TextWidget'
import { ref } from 'vue'

const { widget } = defineProps<{
  widget: TextWidget
}>()

const content = useReactiveObjectProp<TextWidget, string>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)

const isEditing = ref(false)

function startEdition() {
  isEditing.value = true
}

function exitEdition() {
  if (!isEditing.value) return
  isEditing.value = false
  widget.updateContent(content.value)
}
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
