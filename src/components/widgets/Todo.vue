<template>
  <div
    v-if="!expanded"
    class="text-xs overflow-y-hidden"
  >
    <ol>
      <li
        v-for="item in document.value"
        :key="item.id"
        class="flex items-center rounded hover:bg-gray-600"
      >
        <div class="flex h-3 items-center">
          <input
            :checked="item.checked"
            name="candidates"
            type="checkbox"
            class="h-3 w-3 rounded border-gray-300 text-green-400 focus:ring-indigo-600 cursor-pointer"
          >
        </div>
        <div class="ml-4 truncate">
          {{ item.value }}
        </div>
      </li>
    </ol>
  </div>
  <div v-else>
    <div class="text-3xl text-center mb-8">
      {{ document.name }}
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
        v-for="(item, index) in document.value"
        :key="item.id"
        class="group flex justify-between items-center p-1 pr-2 rounded hover:bg-gray-600"
      >
        <div class="flex-1 flex items-center">
          <div class="flex h-10 items-center">
            <input
              :checked="item.checked"
              type="checkbox"
              class="h-8 w-8 rounded border-gray-300 text-green-400 focus:ring-indigo-600 cursor-pointer"
              @input="check(index)"
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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import GenericButton from '@/components/GenericButton.vue'
import { v4 as getId } from 'uuid'

const emits = defineEmits(['update'])

const props = defineProps({
  document: {
    type: Object,
    required: true
  },
  expanded: {
    type: Boolean,
    default: false
  }
})

const newItem = ref('')

function addItem () {
  const newList = props.document.value
  newList.push({
    id: getId(),
    value: newItem.value,
    checked: false
  })
  emits('update', newList)
  newItem.value = ''
}

function check (index) {
  const newList = props.document.value
  newList[index].checked = !newList[index].checked
  emits('update', newList)
}

function remove (index) {
  const newList = props.document.value
  newList.splice(index, 1)
  emits('update', newList)
}

</script>
