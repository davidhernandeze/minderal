<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import Menu from 'primevue/menu'
import { Widget } from '@/domain'

const { widget } = defineProps<{
  widget: Widget
}>()

const menu = useTemplateRef('menu')
const event = defineModel<Event>('event')

watch(event, (e) => menu.value?.toggle(e))

const items = ref([
  {
    label: 'Options',
    items: [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => {
        }
      },
      {
        label: 'Copy to clipboard',
        icon: 'pi pi-copy',
        command: () => {
        }
      },
      {
        label: 'Rename',
        icon: 'pi pi-pencil',
        command: () => {}
      },
      {
        label: 'Move to...',
        icon: 'pi pi-folder-open',
        command: () => {
        }
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        command: () => {
          widget.delete()
        }
      }
    ]
  }
])
</script>
<template>
  <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" />
</template>
