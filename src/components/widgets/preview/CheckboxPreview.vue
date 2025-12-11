<script setup lang="ts">
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import CheckboxWidget from '@/domain/widgets/CheckboxWidget'
import { ToggleSwitch } from 'primevue'

const { widget } = defineProps<{
  widget: CheckboxWidget
}>()

const content = useReactiveObjectProp<CheckboxWidget, boolean>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)


async function switchValue() {
  await widget.updateContent(content.value)
}
</script>

<template>
  <div class="flex justify-center h-full items-center">
    <ToggleSwitch v-model="content" pt:root:class="scale-200" @change="switchValue" />
  </div>
</template>

<style scoped></style>
