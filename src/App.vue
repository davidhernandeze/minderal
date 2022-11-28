<template>
  <div class="h-screen w-screen bg-gray-900 text-gray-100">
    <div class="flex">
      <Sidebar/>
      <div class="relative flex-1 container max-w-2xl mx-auto px-4 pt-10 overflow-y-scroll">
        <router-view/>
      </div>
    </div>
  </div>
</template>
<script setup>
import Sidebar from '@/components/Sidebar.vue'
</script>
