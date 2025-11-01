<script setup lang="ts">
import Workspace from '@/components/Workspace.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import useApplication from '@/composables/useApplication.js'
import { Tab } from '@/domain/Tab.js'

const metadataStore = useMetadataStore()
const { tabs }: Tab[] = useApplication()

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
