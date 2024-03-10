<template>
  <div
    class="fixed inset-0 z-20 bg-gray-800 text-gray-50"
    :style="{'background-color': doc.settings.bg_color, 'color': doc.settings.text_color}"
  >
    <button
      class="absolute right-0 m-4"
      @click="close"
    >
      <i class="fa-light fa-times opacity-30" />
    </button>
    <div class="text-2xl p-8">
      {{ doc.value }}
    </div>
  </div>
</template>

<script setup>
import { Doc } from '@/types.js'
import { inject } from 'vue'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const navigate = inject('navigate')

function close () {
  navigate(props.doc.parent_id)
}
</script>
