<script setup>
defineProps({
  urlPreview: {
    type: Object,
    required: true
  }
})
</script>
<template>
  <div class="flex gap-4 h-full">
    <img
      v-if="urlPreview.image"
      class="h-14"
      :src="urlPreview.image"
      :alt="urlPreview.title"
    >
    <div class="flex-1 overflow-y-auto h-full">
      <h4 class="font-bold break-all">
        {{ urlPreview.title }}
      </h4>
      <p class="text-base">
        {{ urlPreview.description }}
      </p>
    </div>
  </div>
</template>
