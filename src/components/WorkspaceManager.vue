<script setup>
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

function updateLabel(tab, newLabel) {
  tab.label = newLabel.label
  tab.icon = newLabel.icon
}
</script>

<template>
  <div>
    <Workspace
      v-for="(tab, index) in tabs"
      v-show="tab.isOpen"
      :key="tab.id"
      :connection-id="tab.connectionId"
      :doc-id="tab.docId"
      @change-tab-label="(newLabel) => updateLabel(tab, newLabel)"
      @navigate="(docId) => metadataStore.updateTabDoc(index, docId)"
    />
  </div>
</template>
