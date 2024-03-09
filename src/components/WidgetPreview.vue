<template>
  <div
    class="flex overflow-visible flex-col bg-gray-600 h-28 rounded relative cursor-pointer p-2 shadow-md border border-gray-600 hover:border-gray-500 hover:shadow-2xl"
    @click="clickAction"
  >
    <div class="flex justify-between">
      <div v-if="widgetProps.hidePreviewHeader" />
      <div
        v-else
        class="flex-1 flex justify-start items-center text-gray-400 mb-2 truncate"
      >
        <i
          :class="icon"
          class="h-3"
        />
        <input
          v-model="renameInput"
          class="text-xs ml-2 bg-transparent border-none hover:text-gray-50 focus:text-gray-50 focus:outline-none"
          @click.stop
          @focus="e => startNameEdition(e)"
          @blur="endNameEdition"
        >
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
          <MenuItems class="absolute -translate-x-12 z-10 w-22 rounded-md bg-gray-800 shadow-lg overflow-hidden focus:outline-none">
            <div>
              <MenuItem
                v-for="rowAction in rowActions"
                :key="rowAction.action"
                v-slot="{ active }"
              >
                <button
                  class="w-full text-left"
                  :class="[active ? 'bg-gray-700 text-gray-100' : 'text-gray-200', 'block px-4 py-2 text-sm']"
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
    <div class="flex-1 overflow-hidden">
      <Widget
        :doc="doc"
        @update="newValue => db.updateDocument(doc, newValue)"
        @add-actions="addActions"
      />
    </div>
  </div>
</template>
<script setup>
import { defineAsyncComponent, inject, ref } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Doc } from '@/types.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
const navigate = inject('navigate')
const db = inject('db')

const renameInput = ref(props.doc.name)
const isEditingName = ref(false)
const widgetProps = getWidgetProps(props.doc.type)
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
  await db.renameDocument(props.doc, renameInput.value)
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
      db.deleteDocRecursively(props.doc)
    }
  }
])

function addActions (actions) {
  rowActions.value = rowActions.value.concat(actions)
}

</script>
