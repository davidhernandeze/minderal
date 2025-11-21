<script setup lang="ts">
import Button from 'primevue/button'
import ButtonGroup from 'primevue/buttongroup'
import { Workspace } from '@/domain'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { WidgetTypeDefinition } from '@/domain/widgets'

const { workspace } = defineProps<{ workspace: Workspace }>()
const widgets = useReactiveObjectProp<Workspace, WidgetTypeDefinition[]>(
  workspace,
  (w) => w.getWidgetTypes(),
  'widgetTypes:changed'
)

defineEmits(['select'])
</script>
<template>
  <ButtonGroup variant="outlined">
    <Button
      v-for="widget of widgets"
      :key="widget.key"
      :label="widget.label"
      :icon="widget.icon"
      variant="outlined"
      @click="$emit('select', widget.key)"
    />
  </ButtonGroup>
</template>
