<script setup>
defineProps({
  urlPreview: {
    type: Object,
    required: true
  }
})
</script>
<template>
  <div class="flex flex-col gap-4 h-full">
    <div class="h-14 flex justify-center">
      <img v-if="urlPreview.image" class="h-full" :src="urlPreview.image" :alt="urlPreview.title" />
    </div>
    <div class="flex-1 overflow-y-auto h-full">
      <h4 class="font-bold break-words">
        {{ urlPreview.title }}
      </h4>
      <p class="text-xs break-words">
        {{ urlPreview.description }}
      </p>
    </div>
  </div>
</template>
