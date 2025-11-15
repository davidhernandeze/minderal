<script setup lang="ts">
import Workspace from '@/components/Workspace.vue'
import useApplication from '@/composables/useApplication.js'

const { tabs } = useApplication()
</script>

<template>
  <div>
    <Workspace
      v-for="tab in tabs"
      v-show="tab.isOpen"
      :key="tab.id"
      :workspace="tab.workspace"
      @navigate="(docId) => tab.setDocId(docId)"
    />
  </div>
</template>
