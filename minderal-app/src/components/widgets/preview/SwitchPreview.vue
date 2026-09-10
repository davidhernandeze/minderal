<script setup lang="ts">
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import SwitchWidget from '@/domain/widgets/SwitchWidget'
import { ToggleSwitch } from 'primevue'

const { widget } = defineProps<{
  widget: SwitchWidget
}>()

const content = useReactiveObjectProp<SwitchWidget, boolean>(
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
