<script setup>
import { Doc } from '@/classes/Doc.js'
import useChecklist from '@/composables/useChecklist.js'
import { toRef } from '@vueuse/core'
import { inject } from 'vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const doc = toRef(props, 'doc')
const workspace = inject('workspace')
const { visibleItems } = useChecklist(workspace, doc)
</script>

<template>
  <ol class="h-full overflow-y-auto cursor-pointer">
    <li v-for="item in visibleItems" :key="item.id" class="flex items-center rounded-sm">
      <div class="flex items-center">
        <input
          :checked="item.checked"
          name="candidates"
          type="checkbox"
          class="w-3 h-3 rounded-sm border-gray-300 text-green-400 focus:ring-indigo-600 cursor-pointer"
        />
      </div>
      <div class="ml-2 truncate">
        {{ item.value }}
      </div>
    </li>
  </ol>
</template>
