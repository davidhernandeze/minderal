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
  <div class="flex items-center justify-evenly gap-4">
    <div class="flex justify-center">
      <Button @click="decrement" icon="bi bi-dash" severity="secondary" />
    </div>
    <p class="text-[400%] text-center">{{ value }}</p>
    <div>
      <Button @click="increment" icon="bi bi-plus" severity="secondary" />
    </div>
  </div>
</template>
