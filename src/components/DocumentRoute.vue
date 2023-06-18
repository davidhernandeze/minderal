<template>
  <nav
    class="flex"
    aria-label="Breadcrumb"
  >
    <ol
      role="list"
      class="flex items-center space-x-4"
    >
      <li
        class="flex items-center text-gray-500 hover:text-gray-100 cursor-pointer"
        @click="$emit('navigate', '')"
      >
        <i class="fa-solid fa-home h-3 mr-2" />
      </li>
      <li
        v-for="folder in route"
        :key="folder.id"
        @click="$emit('navigate', folder.id)"
      >
        <div class="flex items-center">
          <i class="fa-solid fa-angle-right h-3 mr-2 text-gray-400" />
          <a
            href="#"
            class="ml-4 text-sm font-medium text-gray-500 hover:text-gray-100 truncate"
          >{{ folder.name }}</a>
        </div>
      </li>
    </ol>
  </nav>
</template>
<script setup>

defineEmits(['navigate'])

defineProps({
  route: {
    type: Array,
    default: () => []
  }
})
</script>
