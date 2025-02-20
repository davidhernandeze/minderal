<script setup>
import { defineAsyncComponent, inject, ref, useTemplateRef, watch } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'
import { vOnClickOutside } from '@vueuse/components'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Doc } from '@/classes/Doc.js'
import { useClipboard } from '@vueuse/core'
import GenericButton from '@/components/GenericButton.vue'
import TextInput from '@/components/TextInput.vue'
import Modal from '@/components/Modal.vue'
import WidgetForm from '@/components/WidgetForm.vue'
import InvisibleInput from '@/components/InvisibleInput.vue'
import WidgetVersionsModal from '@/components/WidgetVersionsModal.vue'
import DocSelector from '@/components/DocSelector.vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

defineEmits(['enable-drag', 'disable-drag'])

const { copy } = useClipboard()

const navigate = inject('navigate')
const workspace = inject('workspace')

const versionsModalOpen = ref(false)

const moveToModalOpen = ref(false)

const renameModalOpen = ref(false)
const renameInput = ref(props.doc.name)
const renameInputEl = useTemplateRef('renameInputEl')

const isEditingName = ref(false)
watch(
  () => props.doc.name,
  () => {
    renameInput.value = props.doc.name
  },
)

const widgetFormOpen = ref(false)

const widgetProps = getWidgetProps(props.doc.widget) ?? getWidgetProps('text')
const icon = widgetProps.icon
const Widget = defineAsyncComponent(() => {
  return import(`./widgets/${widgetProps.previewComponent}.vue`)
})

async function clickAction() {
  if (widgetProps.expandable) {
    if (isEditingName.value) {
      isEditingName.value = false
      return
    }
    await navigate(props.doc._id)
  }
}

async function endNameEdition(event) {
  if (!isEditingName.value) return
  isEditingName.value = false
  renameModalOpen.value = false
  event.target?.blur()
  await workspace.renameDoc({ ...props.doc }, renameInput.value)
}

function startNameEdition(event) {
  isEditingName.value = true
  const input = event.target
  input.focus()
}

function copyToClipboard() {
  if (widgetProps.toClipboard) {
    copy(widgetProps.toClipboard(props.doc))
    return
  }

  copy(props.doc.content)
}

const rowActions = ref([
  {
    action: 'edit',
    label: 'Edit',
    display: !!widgetProps.formComponent,
    onClick() {
      widgetFormOpen.value = true
    },
  },
  {
    action: 'copy_to_clipboard',
    label: 'Copy to clipboard',
    display: true,
    onClick: copyToClipboard,
  },
  {
    action: 'rename',
    label: 'Rename',
    display: true,
    onClick() {
      if (!widgetProps.standalonePreview) {
        renameInputEl.value.focus()
        return
      }

      renameModalOpen.value = true
      isEditingName.value = true
    },
  },
  {
    action: 'move_to',
    label: 'Move to...',
    display: true,
    onClick() {
      moveToModalOpen.value = true
    },
  },
  {
    action: 'version_history',
    label: 'Version history',
    display: true,
    onClick() {
      versionsModalOpen.value = true
    },
  },
  {
    action: 'delete',
    label: 'Delete',
    display: true,
    onClick() {
      workspace.deleteDocRecursively({ ...props.doc })
    },
  },
])

function addActions(actions) {
  rowActions.value = rowActions.value.concat(actions)
}

async function moveDoc(parentDoc) {
  await workspace.moveDoc({ ...props.doc }, parentDoc)
  moveToModalOpen.value = false
}
</script>
<template>
  <div
    :class="[props.doc.widget === 'folder' ? 'h-24' : 'h-52']"
    class="preview-bounds relative flex overflow-visible flex-col bg-gray-700 rounded-sm shadow-md border border-gray-600 hover:border-gray-500 hover:shadow-2xl"
  >
    <!--    <WidgetPreviewFloatingMenu />-->
    <div
      :class="[
        widgetProps.standalonePreview ? 'shadow-none' : 'shadow-sm',
        props.doc.widget === 'folder' ? 'h-auto p-2 pb-0' : 'p-2',
      ]"
      class="flex justify-between"
    >
      <div v-if="widgetProps.standalonePreview" />
      <div v-else class="flex-1 flex justify-start items-center text-gray-400 truncate">
        <i class="text-xl" :class="icon" />
        <InvisibleInput
          v-model:el="renameInputEl"
          v-model:value="renameInput"
          v-on-click-outside="endNameEdition"
          class="flex-1 ml-2 bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-hidden p-0"
          @click.stop
          @focus="(e) => startNameEdition(e)"
          @keyup.enter="endNameEdition"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="!widgetProps.hideCopyButton"
          class="rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
          @click="copyToClipboard"
        >
          <i class="bi bi-copy" />
        </button>
        <div
          class="drag-zone rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
          @pointerdown="$emit('enable-drag')"
          @pointerup="$emit('disable-drag')"
        >
          <i class="bi bi-grip-horizontal" />
        </div>
        <Menu as="div" class="relative inline-block text-left">
          <div>
            <MenuButton class="flex items-start" @click.stop>
              <div
                class="rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
              >
                <i class="bi bi-three-dots-vertical" />
              </div>
            </MenuButton>
          </div>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems
              class="absolute -translate-x-32 z-10 w-36 rounded-md bg-gray-800 shadow-lg overflow-hidden focus:outline-hidden"
            >
              <div>
                <MenuItem
                  v-for="rowAction in rowActions"
                  v-show="rowAction.display"
                  :key="rowAction.action"
                  v-slot="{ active }"
                >
                  <button
                    class="w-full text-left"
                    :class="[
                      active ? 'bg-gray-900 text-gray-100' : 'text-gray-200',
                      'block px-4 py-2 text-sm',
                    ]"
                    @click.stop="rowAction.onClick"
                  >
                    {{ rowAction.label }}
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </transition>
        </Menu>
      </div>
    </div>
    <div
      class="flex-1 overflow-hidden p-2 h-full"
      :class="{ 'pt-0': widgetProps.standalonePreview }"
      @click="clickAction"
    >
      <Widget :doc="doc" @add-actions="addActions" />
    </div>
    <Modal v-model:is-open="renameModalOpen">
      <template #body>
        <form class="text-gray-200 text-xl" @submit.prevent="endNameEdition">
          <h1 class="mb-1">Rename Widget</h1>
          <TextInput v-model:value="renameInput" label="New Name" type="text" class="my-3 w-full" />
          <GenericButton class="bg-indigo-600 hover:bg-indigo-500 mt-6" type="submit">
            Rename
          </GenericButton>
        </form>
      </template>
    </Modal>
    <WidgetVersionsModal :doc="doc" v-model:is-open="versionsModalOpen" />
    <Modal v-if="widgetProps.formComponent" v-model:is-open="widgetFormOpen">
      <template #body>
        <WidgetForm :doc="doc" :widget="widgetProps" @save="widgetFormOpen = false" />
      </template>
    </Modal>
    <Modal v-model:is-open="moveToModalOpen">
      <template #body>
        <DocSelector @select="moveDoc" :parents-only="true" :exclude-doc-ids="[props.doc._id]" />
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.widget-preview {
  box-shadow:
    9px 9px 24px #303946,
    -9px -9px 24px #3e495c;
}
</style>
