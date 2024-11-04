<script setup>
import WidgetPreview from '@/components/WidgetPreview.vue'
import useFolder from '@/composables/useFolder.js'
import { inject } from 'vue'

const workspace = inject('workspace')
const searchQuery = inject('searchQuery')

const { filteredDocuments } = useFolder(workspace.childDocs, searchQuery)

</script>

<template>
  <div class="pr-2 pb-32 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <WidgetPreview
      v-for="doc in filteredDocuments"
      :key="doc._id"
      :doc="doc"
    />
  </div>
</template>
