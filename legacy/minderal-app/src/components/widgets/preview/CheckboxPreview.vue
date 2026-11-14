<script setup lang="ts">
import InvisibleTextInput from '@/components/generic/InvisibleTextInput.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { ref, watch } from 'vue'
import Checkbox from 'primevue/checkbox';
import CheckboxWidget from '@/domain/widgets/CheckboxWidget'

const { widget } = defineProps<{
  widget: CheckboxWidget
}>()

const name = useReactiveObjectProp<CheckboxWidget, string>(
  widget,
  (w) => w.getName(),
  'name:changed'
)

const content = useReactiveObjectProp<CheckboxWidget, boolean>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)

const checked = ref(content.value)
watch(checked, async (newValue) => {
  await widget.updateContent(newValue)
  checked.value = widget.getContent()
})

const isEditing = ref(false)

function startEdition() {
  isEditing.value = true
}

function exitEdition() {
  if (!isEditing.value) return
  isEditing.value = false
  widget.rename(name.value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <Checkbox v-model="checked" binary />
    <InvisibleTextInput
      v-model="name"
      class="w-full h-full break-words"
      :class="{ 'line-through': content }"
      @focusout="exitEdition"
      @focusin="startEdition"
    />
  </div>
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
