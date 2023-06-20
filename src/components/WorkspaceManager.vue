<template>
  <Workspace
    v-for="(tab, index) in tabs"
    v-show="tab.isOpen"
    :key="tab.id"
    :database-id="tab.databaseId"
    :document-id="tab.documentId"
    @navigate="(documentId) => updateTabDocument(index, documentId)"
  />
</template>

<script setup>
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

function updateTabDocument (tabIndex, documentId) {
  metadataStore.updateTabDocument(tabIndex, documentId)
}
</script>
