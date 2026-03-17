<script setup lang="ts">
import { ref, useTemplateRef, watch } from 'vue'
import Menu from 'primevue/menu'
import { Widget } from '@/domain'
import Dialog from 'primevue/dialog'
import TextInput from '@/components/TextInput.vue'
import Button from 'primevue/button'
import DocSelector from '@/components/DocSelector.vue'

const { widget } = defineProps<{
  widget: Widget
}>()

const menu = useTemplateRef('menu')
const event = defineModel<Event>('event')

const renameModalOpen = ref(false)
const renameInput = ref(widget.getName())
const moveToModalOpen = ref(false)

watch(event, (e) => menu.value?.toggle(e))

const items = ref([
  {
    label: 'Options',
    items: [
      // {
      //   label: 'Edit',
      //   icon: 'pi pi-pencil',
      //   command: () => {
      //   }
      // },
      // {
      //   label: 'Copy to clipboard',
      //   icon: 'pi pi-copy',
      //   command: () => {
      //   }
      // },
      {
        label: 'Rename',
        icon: 'pi pi-pencil',
        command: () => {
          renameModalOpen.value = true
        }
      },
      {
        label: 'Move to...',
        icon: 'pi pi-folder-open',
        command: () => {
          moveToModalOpen.value = true
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

function endNameEdition() {
  if (!renameModalOpen.value) return
  renameModalOpen.value = false
  widget.rename(renameInput.value)
}

async function moveDoc(parentDoc: string) {
  await widget.move(parentDoc)
  moveToModalOpen.value = false
}
</script>
<template>
  <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" pt:root:class="text-xss" />

  <Dialog v-model:visible="renameModalOpen" header="Rename widget" modal>
    <form class="text-gray-200 text-xl" @submit.prevent="endNameEdition">
      <TextInput v-model="renameInput" label="New Name" type="text" class="my-3 w-full" />
      <Button type="submit"> Rename </Button>
    </form>
  </Dialog>

  <Dialog v-model:visible="moveToModalOpen" header="Move widget" modal style="width: 35rem">
    <DocSelector
      :db="widget.db"
      :parents-only="true"
      :excluded-doc-ids="[widget.doc._id]"
      @select="moveDoc"
    />
  </Dialog>
</template>
