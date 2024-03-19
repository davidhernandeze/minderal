<script setup>
import GenericButton from '@/components/GenericButton.vue'
import useChecklist from '@/composables/useChecklist.js'
import { Doc } from '@/classes/Doc.js'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
const emits = defineEmits(['update'])
const { newItem, addItem, check, visibleItems, remove } = useChecklist(toRef(() => props.doc), emits)
</script>

<template>
  <div class="text-3xl text-center mb-8">
    {{ doc.name }}
  </div>
  <div class="flex items-center justify-center">
    <input
      ref="searchInput"
      v-model="newItem"
      class="border-none bg-transparent p-1 focus:outline-none outline-none rounded focus:ring-0"
      type="text"
      placeholder="New item"
      @keyup.enter="addItem"
    >
    <GenericButton @click="addItem">
      Add
    </GenericButton>
  </div>
  <ol class="mt-4">
    <li
      v-for="(item, index) in visibleItems"
      :key="item.id"
      class="group flex justify-between items-center p-1 pr-2 rounded hover:bg-gray-600"
    >
      <div class="flex-1 flex items-center">
        <div class="flex h-10 items-center">
          <input
            :checked="item.checked"
            type="checkbox"
            class="h-8 w-8 rounded border-gray-300 text-green-400 focus:ring-indigo-600 cursor-pointer"
            @input.stop="check(index)"
          >
        </div>
        <div
          :class="{'line-through': item.checked}"
          class="text-xl ml-4 break-words"
        >
          {{ item.value }}
        </div>
      </div>
      <div
        class="w-10 flex-center text-gray-400 hover:text-red-500 cursor-pointer"
      >
        <div
          class="hidden group-hover:flex-center text-gray-400 hover:text-red-500 cursor-pointer"
          @click.stop="remove(index)"
        >
          <i
            class="fa-solid h-4 fa-trash"
          />
        </div>
      </div>
    </li>
  </ol>
</template>
