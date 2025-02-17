<script setup>
import { inject } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { toRef } from '@vueuse/core'
import { Button } from 'primevue'
import useCounter from '@/composables/useCounter.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true,
  },
})

const workspace = inject('workspace')
const { value, increment, decrement } = useCounter(workspace, toRef(props, 'doc'))
</script>

<template>
  <div class="h-full flex flex-col">
    <p class="flex-1 text-[400%] text-center">{{ value }}</p>
    <div class="h-8 flex gap-4 justify-center">
      <Button @click="decrement" icon="bi bi-dash" severity="secondary" />
      <Button @click="increment" icon="bi bi-plus" severity="secondary" />
    </div>
  </div>
</template>
