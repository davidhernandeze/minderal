<script setup>
import { Doc } from '@/classes/Doc.js'
import useChecklist from '@/composables/useChecklist.js'
import { toRef } from '@vueuse/core'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { visibleItems } = useChecklist(toRef(() => props.doc))

</script>

<template>
  <div class="text-xs overflow-y-hidden">
    <ol>
      <li
        v-for="item in visibleItems"
        :key="item.id"
        class="flex items-center rounded hover:bg-gray-600 my-1"
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
</template>
