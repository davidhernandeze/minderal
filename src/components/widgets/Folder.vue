<template>
  <div class="flex justify-center h-full items-center box-border">
    <div>
      <div class="flex justify-center">
        <i class="fa-solid fa-folder h-10 hover:h-11" />
      </div>
      <div class="flex justify-center">
        {{ document.name }}
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  document: {
    type: Object,
    required: true
  }
})
</script>
