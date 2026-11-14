<script setup lang="ts">
import { Button } from 'primevue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import CounterWidget from '@/domain/widgets/CounterWidget'

const { widget } = defineProps<{
  widget: CounterWidget
}>()

const value = useReactiveObjectProp<CounterWidget, number>(
  widget,
  (w) => w.getContent(),
  'content:changed'
)

async function increment() {
  await widget.updateContent(value.value + 1)
}

async function decrement() {
  await widget.updateContent(value.value - 1)
}
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
