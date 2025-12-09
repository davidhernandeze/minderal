<script setup lang="ts">
import { defineAsyncComponent, ref, useTemplateRef } from 'vue'
import safeImport from '@/utils/safe-import.js'
import { vOnClickOutside } from '@vueuse/components'
import { useClipboard } from '@vueuse/core'
import TextInput from '@/components/TextInput.vue'
import InvisibleInput from '@/components/InvisibleInput.vue'
import DocSelector from '@/components/DocSelector.vue'
import Panel from 'primevue/panel'
import Button from 'primevue/button'
import Menu from 'primevue/menu'
import { useTimeAgo } from '@vueuse/core'
import Dialog from 'primevue/dialog'
import { Widget } from '@/domain'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'

const { widget, hideMenu, single } = defineProps<{
  widget: Widget
  hideMenu?: boolean
  single?: boolean
}>()

defineEmits(['enable-drag', 'disable-drag'])

const { copy } = useClipboard()

const versionsModalOpen = ref(false)

const moveToModalOpen = ref(false)

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')
const renameModalOpen = ref(false)
const renameInputEl = useTemplateRef('renameInputEl')

const timeAgo = useTimeAgo(widget.doc.updated_at)

const isEditingName = ref(false)

const widgetFormOpen = ref(false)

const icon = widget.icon
const WidgetPreviewComponent = defineAsyncComponent(() =>
  safeImport(() => import(`./widgets/preview/${widget.previewComponent}.vue`))
)

async function clickAction() {
  if (widget.expandable) {
    if (isEditingName.value) {
      isEditingName.value = false
      return
    }
    // await navigate(props.doc._id)
  }
}

async function endNameEdition(event) {
  if (!isEditingName.value) return
  isEditingName.value = false
  renameModalOpen.value = false
  event.target?.blur()
  await widget.rename(widgetName.value)
}

function startNameEdition(event) {
  isEditingName.value = true
  const input = event.target
  input.focus()
}

function copyToClipboard() {
  copy(widget.getPastableContent())
}

const rowActions = ref([
  {
    action: 'edit',
    label: 'Edit',
    display: !!widget.formComponent,
    onClick() {
      widgetFormOpen.value = true
    }
  },
  {
    action: 'copy_to_clipboard',
    label: 'Copy to clipboard',
    display: true,
    onClick: widget.getPastableContent()
  },
  {
    action: 'rename',
    label: 'Rename',
    display: true,
    onClick() {
      if (!widget.standalonePreview) {
        renameInputEl.value.focus()
        return
      }

      renameModalOpen.value = true
      isEditingName.value = true
    }
  },
  {
    action: 'move_to',
    label: 'Move to...',
    display: true,
    onClick() {
      moveToModalOpen.value = true
    }
  },
  {
    action: 'version_history',
    label: 'Version history',
    display: true,
    onClick() {
      versionsModalOpen.value = true
    }
  },
  {
    action: 'delete',
    label: 'Delete',
    display: true,
    onClick() {
      workspace.deleteDocRecursively({ ...props.doc })
    }
  }
])

function addActions(actions) {
  rowActions.value = rowActions.value.concat(actions)
}

async function moveDoc(parentDoc) {
  await workspace.moveDoc({ ...props.doc }, parentDoc)
  moveToModalOpen.value = false
}

const menu = useTemplateRef('menu')
const items = ref([
  {
    label: 'Options',
    items: [
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        command: () => {
          widgetFormOpen.value = true
        }
      }
    ]
  }
])

const toggle = (event) => {
  menu.value.toggle(event)
}
</script>
<template>
  <Panel
    :pt:header:class="['!p-2', widget.doc.widget === 'folder' ? '!pb-0' : '']"
    pt:root:class=" h-full flex flex-col"
    pt:content-container:class="h-full min-h-0 flex-1 flex flex-col"
    pt:content:class="h-full flex-1 min-h-0 flex flex-col !pb-0"
    pt:footer:class="h-[2.5rem] !py-0"
  >
    <template #header>
      <div v-if="widget.standalonePreview || single" />
      <div v-else class="flex-1 flex justify-start items-center text-gray-400 truncate pr-2">
        <i class="text-xl" :class="icon" />
        <InvisibleInput
          v-model:el="renameInputEl"
          v-model:value="widgetName"
          v-on-click-outside="endNameEdition"
          class="flex-1 ml-2 bg-transparent border-none focus:outline-hidden p-0"
          @click.stop
          @focus="(e) => startNameEdition(e)"
          @keyup.enter="endNameEdition"
        />
      </div>
    </template>
    <template #icons>
      <div v-if="!hideMenu" class="flex items-center gap-2">
        <div
          class="drag-zone rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
          @pointerdown="$emit('enable-drag')"
          @pointerup="$emit('disable-drag')"
        >
          <i class="bi bi-grip-horizontal" />
        </div>
        <div class="card flex justify-center">
          <Button
            type="button"
            icon="bi bi-three-dots-vertical"
            variant="text"
            aria-haspopup="true"
            aria-controls="overlay_menu"
            @click="toggle"
          />
          <Menu id="overlay_menu" ref="menu" :model="items" :popup="true" />
        </div>
      </div>
    </template>
    <template v-if="!widget.standalonePreview" #footer>
      <div class="relative flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <button
            v-if="!widget.hideCopyButton"
            class="rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
            @click="copyToClipboard"
          >
            <i class="bi bi-copy" />
          </button>
        </div>
        <span class="text-xs text-text-gray-700 dark:text-gray-500">Updated {{ timeAgo }}</span>
        <!--        <span class="absolute bottom-[2rem] text-xs text-text-gray-700 dark:text-gray-500">{{ doc._id }}</span>-->
      </div>
    </template>

    <WidgetPreviewComponent :widget="widget" @click="clickAction" @add-actions="addActions" />

    <Dialog v-model:visible="renameModalOpen" header="Rename widget" modal>
      <form class="text-gray-200 text-xl" @submit.prevent="endNameEdition">
        <TextInput v-model="renameInput" label="New Name" type="text" class="my-3 w-full" />
        <Button type="submit"> Rename </Button>
      </form>
    </Dialog>
    <!--    <WidgetVersionsModal v-model:is-open="versionsModalOpen" :doc="doc" />-->
    <Dialog
      v-if="widget.formComponent"
      v-model:visible="widgetFormOpen"
      header="Edit widget"
      modal
      style="width: 40rem"
    >
    </Dialog>
    <Dialog v-model:visible="moveToModalOpen" header="Move widget" modal style="width: 35rem">
      <DocSelector :parents-only="true" :exclude-doc-ids="[widget.doc._id]" @select="moveDoc" />
    </Dialog>
  </Panel>
</template>
