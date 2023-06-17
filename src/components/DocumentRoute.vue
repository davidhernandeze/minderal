<template>
  <i class="fa-light h-3 fa-folder mr-2" />
  <div
    v-for="folder in route"
    class="mx-2"
  >
    {{ folder.name }}
  </div>
</template>
<script setup>
defineProps({
  route: {
    type: Array,
    default: []
  }
})
</script>
