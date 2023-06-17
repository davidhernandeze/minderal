<template>
  <i class="fa-light h-3 fa-folder mr-2" />
  <div
    v-for="folder in route"
    :key="folder.id"
    class="mx-2 cursor-pointer"
    @click="$emit('navigate', folder.id)"
  >
    {{ folder.name }}
  </div>
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
