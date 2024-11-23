<script setup>
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'

const metadataStore = useMetadataStore()
const { tabs } = storeToRefs(metadataStore)

</script>

<template>
  <div>
    <Workspace
      v-for="(tab, index) in tabs"
      v-show="tab.isOpen"
      :key="tab.id"
      :connection-id="tab.connectionId"
      :doc-id="tab.docId"
      @change-tab-label="(label) => tab.label = label"
      @navigate="(docId) => metadataStore.updateTabDoc(index, docId)"
    />
  </div>
</template>
