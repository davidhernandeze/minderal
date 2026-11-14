<script setup>
import { inject } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { toRef } from '@vueuse/core'
import { Button } from 'primevue'
import useCounter from '@/composables/useCounter.js'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const workspace = inject('workspace')
const { value, increment, decrement } = useCounter(workspace, toRef(props, 'doc'))
</script>

<template>
  <div class="flex items-center justify-evenly gap-4">
    <div class="flex justify-center">
      <Button icon="bi bi-dash" severity="secondary" @click="decrement" />
    </div>
    <p class="text-[400%] text-center">{{ value }}</p>
    <div>
      <Button icon="bi bi-plus" severity="secondary" @click="increment" />
    </div>
  </div>
</template>
