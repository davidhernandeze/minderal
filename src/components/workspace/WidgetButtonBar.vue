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
</script>
<template>
  <ButtonGroup variant="outlined">
    <Button
      v-for="(widget, key) of widgets"
      :key="key"
      :label="widget.label"
      :icon="widget.icon"
      variant="outlined"
      @click="$emit('click-widget', key)"
    />
  </ButtonGroup>
</template>
