<script setup>
import { defineAsyncComponent, defineEmits, inject, ref, useTemplateRef, watch } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'
import { vOnClickOutside } from '@vueuse/components'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Doc } from '@/classes/Doc.js'
import { useClipboard } from '@vueuse/core'
import GenericButton from '@/components/GenericButton.vue'
import TextInput from '@/components/TextInput.vue'
import Modal from '@/components/Modal.vue'
import InvisibleInput from '@/components/InvisibleInput.vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

defineEmits(['enable-drag', 'disable-drag'])

const { copy } = useClipboard()

const navigate = inject('navigate')
const workspace = inject('workspace')

const renameInput = ref(props.doc.name)
const renameInputEl = useTemplateRef('renameInputEl')

const isEditingName = ref(false)
watch(() => props.doc.name, () => {
  renameInput.value = props.doc.name
})

const widgetProps = getWidgetProps(props.doc.widget)
const icon = widgetProps.icon
const Widget = defineAsyncComponent(() => {
  return import(`./widgets/${widgetProps.previewComponent}.vue`)
})

async function clickAction () {
  if (widgetProps.expandable) {
    if (isEditingName.value) {
      isEditingName.value = false
      return
    }
    await navigate(props.doc._id)
  }
}

async function endNameEdition () {
  if (!isEditingName.value) return
  isEditingName.value = false
  renameModalOpen.value = false
  renameInputEl.value?.blur()
  await workspace.renameDoc(props.doc, renameInput.value)
}

function startNameEdition (event) {
  isEditingName.value = true
  const input = event.target
  input.setSelectionRange(0, input.value.length)
  input.focus()
}

const rowActions = ref([
  {
    action: 'delete',
    label: 'Delete',
    onClick () {
      workspace.deleteDocRecursively({ ...props.doc })
    }
  },
  {
    action: 'copy_to_clipboard',
    label: 'Copy to clipboard',
    onClick () {
      copy(props.doc.content)
    }
  },
  {
    action: 'rename',
    label: 'Rename',
    onClick () {
      if (!widgetProps.standalonePreview) {
        renameInputEl.value.focus()
        return
      }

      renameModalOpen.value = true
    }
  }
])

function addActions (actions) {
  rowActions.value = rowActions.value.concat(actions)
}

const renameModalOpen = ref(false)

</script>
<template>
  <div
    :class="[ props.doc.widget === 'folder' ? 'h-18' : 'h-40']"
    class="relative flex overflow-visible flex-col bg-gray-700 rounded shadow-md border border-gray-600 hover:border-gray-500 hover:shadow-2xl"
  >
    <!--    <WidgetPreviewFloatingMenu />-->
    <div
      :class="[
        widgetProps.standalonePreview ? 'shadow-none' : 'shadow',
        props.doc.widget === 'folder' ? 'h-auto p-2 pb-0' : 'p-2'
      ]"
      class="flex justify-between"
    >
      <div v-if="widgetProps.standalonePreview" />
      <div
        v-else
        class="flex-1 flex justify-start items-center text-gray-400 truncate"
      >
        <i
          :class="icon"
          class="h-3"
        />
        <input
          ref="renameInputEl"
          v-model="renameInput"
          v-on-click-outside="endNameEdition"
          class="flex-1 ml-2 text-xs bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-none p-0"
          @click.stop
          @focus="e => startNameEdition(e)"
          @keyup.enter="endNameEdition"
        >
      </div>
      <div class="flex items-center gap-2">
        <div
          class="drag-zone rounded-full p-1 text-gray-400 flex-center hover:text-gray-100 cursor-pointer"
          @pointerdown="$emit('enable-drag')"
          @pointerup="$emit('disable-drag')"
        >
          <i class="fa-solid fa-grip-dots h-3" />
        </div>
        <Menu
          as="div"
          class="relative inline-block text-left"
        >
          <div>
            <MenuButton
              class="flex items-start"
              @click.stop
            >
              <div
                class="rounded-full p-1 text-gray-400 flex-center hover:text-gray-100"
              >
                <i class="fa-solid h-3 fa-ellipsis-vertical" />
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
              class="absolute -translate-x-32 z-10 w-36 rounded-md bg-gray-800 shadow-lg overflow-hidden focus:outline-none"
            >
              <div>
                <MenuItem
                  v-for="rowAction in rowActions"
                  :key="rowAction.action"
                  v-slot="{ active }"
                >
                  <button
                    class="w-full text-left"
                    :class="[active ? 'bg-gray-900 text-gray-100' : 'text-gray-200', 'block px-4 py-2 text-sm']"
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
      class="flex-1 overflow-hidden p-2 cursor-pointer"
      @click="clickAction"
    >
      <Widget
        :doc="doc"
        @add-actions="addActions"
      />
    </div>
    <Modal
      v-model:is-open="renameModalOpen"
    >
      <template #body>
        <form
          class="text-gray-200 text-xl "
          @submit.prevent="endNameEdition"
        >
          <h1 class="mb-1">
            Rename Widget
          </h1>
          <TextInput
            v-model:value="renameInput"
            label="New Name"
            type="text"
            class="my-3 w-full"
          />
          <GenericButton
            class="bg-indigo-600 hover:bg-indigo-500 mt-6"
            type="submit"
          >
            Rename
          </GenericButton>
        </form>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.widget-preview {
  box-shadow:  9px 9px 24px #303946,
  -9px -9px 24px #3e495c;
}
</style>
