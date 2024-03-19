<script setup>
import { Doc } from '@/classes/Doc.js'
import { inject } from 'vue'
import DebugStore from '@/stores/DebugStore.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { lastReconnect, reconnects } = DebugStore

const navigate = inject('navigate')

function close () {
  navigate(props.doc.parent_id)
}
</script>

<template>
  <div
    class="fixed inset-0 z-20 bg-gray-800 text-gray-50"
    :style="{'background-color': doc.settings?.bg_color, 'color': doc.settings?.text_color}"
  >
    <button
      class="absolute right-0 m-4"
      @click="close"
    >
      <i class="fa-light fa-times opacity-30" />
    </button>
    <div class="text-2xl p-8">
      {{ doc.content }}
    </div>

    <div class="absolute right-0 opacity-30 bottom-0 p-4">
      <div class="text-sm">
        Last reconnect: {{ lastReconnect }}
      </div>
      <div class="text-sm">
        Reconnects: {{ reconnects }}
      </div>
    </div>
  </div>
</template>
