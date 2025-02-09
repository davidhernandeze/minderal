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
  <div class="overflow-y-hidden">
    <ol>
      <li
        v-for="item in visibleItems"
        :key="item.id"
        class="flex items-center rounded-sm hover:bg-gray-600"
      >
        <div class="flex items-center">
          <input
            :checked="item.checked"
            name="candidates"
            type="checkbox"
            class="w-3 h-3 rounded-sm border-gray-300 text-green-400 focus:ring-indigo-600 cursor-pointer"
          >
        </div>
        <div class="ml-2 truncate">
          {{ item.value }}
        </div>
      </li>
    </ol>
  </div>
</template>
