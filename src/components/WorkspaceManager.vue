<template>
  <div>
    <Workspace
      v-for="(tab, index) in tabs"
      v-show="tab.isOpen"
      :key="tab.id"
      :connection-id="tab.connectionId"
      :document-id="tab.documentId"
      @navigate="(docId) => updateTabDocument(index, docId)"
    />
  </div>
</template>

<script setup>
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/metadata.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

function updateTabDocument (tabIndex, docId) {
  metadataStore.updateTabDocument(tabIndex, docId)
}
</script>
