<template>
  <Workspace
    v-for="tab in tabs"
    v-show="tab.isOpen"
    :key="tab.id"
    :database-id="tab.databaseId"
  />
</template>

<script setup>
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)
</script>
