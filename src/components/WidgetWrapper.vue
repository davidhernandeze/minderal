<template>
  <div
    class="flex flex-col bg-gray-600 h-28 rounded overflow-hidden relative cursor-pointer p-2 shadow-md border border-gray-600 hover:border-gray-500"
    @click="clickAction"
  >
    <div class="flex justify-between">
      <div class="flex-1 flex justify-start items-center text-gray-400 mb-2 truncate">
        <i
          :class="icon"
          class="h-3"
        />
        <div class="text-xs ml-2">
          {{ document.name }}
        </div>
      </div>
      <Menu
        as="div"
        class="relative inline-block text-left"
      >
        <div>
          <MenuButton class="flex items-start" @click.stop="">
            <div
              class="rounded-full p-1 text-gray-400 flex justify-center items-center hover:text-gray-100" >
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
          <MenuItems class="fixed -translate-x-12 z-10 w-22 rounded-md bg-gray-800 shadow-lg overflow-hidden focus:outline-none">
            <div>
              <MenuItem
                v-for="rowAction in rowActions"
                :key="rowAction.action"
                v-slot="{ active }"
              >
                <button
                  class="w-full text-left"
                  :class="[active ? 'bg-gray-700 text-gray-100' : 'text-gray-200', 'block px-4 py-2 text-sm']"
                  @click.stop="$emit(rowAction.action, document)"
                >
                  {{ rowAction.label }}
                </button>
              </MenuItem>
            </div>
          </MenuItems>
        </transition>
      </Menu>
    </div>
    <div class="flex-1">
      <Widget
        :value="document.value"
        @update="(value) => $emit('update', value)"
      />
    </div>
  </div>
</template>
<script setup>
import { defineAsyncComponent } from 'vue'
import { widgets } from '@/enums/widgets.js'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
const emits = defineEmits(['update', 'navigate', 'action'])
const props = defineProps({
  document: {
    type: Object,
    required: true
  }
})
const icon = widgets[props.document.type].icon
const Widget = defineAsyncComponent(() => {
  const componentName = props.document.type.charAt(0).toUpperCase() + props.document.type.slice(1)
  return import(`./widgets/${componentName}.vue`)
})

function clickAction () {
  if (props.document.type === 'folder') {
    emits('navigate', props.document._id)
  }
}

const rowActions = [
  {
    action: 'delete',
    label: 'Delete'
  }
]
</script>
