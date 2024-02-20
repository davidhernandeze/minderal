<template>
  <nav
    ref="container"
    class="flex text-xss w-full overflow-x-auto pb-3 pr-3"
    aria-label="Breadcrumb"
  >
    <ol
      role="list"
      class="flex items-center space-x-1"
    >
      <li
        class="flex items-center text-gray-500 hover:text-gray-100 cursor-pointer"
        @click="$emit('navigate', '')"
      >
        <i class="fa-solid fa-home mr-1" />
      </li>
      <li
        v-for="doc in route"
        :key="doc.id"
        @click="$emit('navigate', doc.id)"
      >
        <div class="flex items-center">
          <i class="fa-solid fa-angle-right text-gray-400 mx-2" />
          <a
            href="#"
            class="text-sm font-medium text-gray-500 hover:text-gray-100 truncate"
          >{{ doc.name }}</a>
        </div>
      </li>
    </ol>
  </nav>
</template>
<script setup>

import { nextTick, ref, watch } from 'vue'

defineEmits(['navigate'])

const props = defineProps({
  route: {
    type: Array,
    default: () => []
  }
})

const container = ref()

watch(() => props.route, async (value) => {
  await nextTick()
  container.value.scrollLeft = container.value.scrollWidth
})

</script>
