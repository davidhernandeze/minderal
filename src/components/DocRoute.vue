<script setup>
import { nextTick, ref, watch } from 'vue'
import { getWidgetProps } from '@/enums/widgets.js'

defineEmits(['navigate'])

const props = defineProps({
  route: {
    type: Array,
    default: () => [],
  },
})
const container = ref()

watch(
  () => props.route,
  async (value) => {
    await nextTick()
    container.value.scrollLeft = container.value.scrollWidth
  },
)
</script>
<template>
  <nav
    ref="container"
    v-bind="$attrs"
    class="flex w-full overflow-x-auto pb-3 pr-3 text-lg"
    aria-label="Breadcrumb"
  >
    <ol role="list" class="flex items-center">
      <li
        class="flex items-center hover:text-(--p-primary-500) cursor-pointer"
        @click="$emit('navigate', '')"
      >
        <i class="bi bi-house text-xl mr-1" />
      </li>
      <li v-for="doc in route" :key="doc.id" @click="$emit('navigate', doc.id)">
        <div class="flex items-center">
          <i class="bi bi-caret-right-fill mx-4" />
          <div class="ml-2 hover:text-(--p-primary-500) ">
            <i :class="getWidgetProps(doc.widget)?.icon" />
            <a href="#" class="font-medium truncate max-w-xs ml-2">{{ doc.name }}</a>
          </div>
        </div>
      </li>
    </ol>
  </nav>
</template>
