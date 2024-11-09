<script setup>
import WidgetPreview from '@/components/WidgetPreview.vue'
import useFolder from '@/composables/useFolder.js'
import { inject } from 'vue'
import draggable from 'vuedraggable'

const workspace = inject('workspace')
const searchQuery = inject('searchQuery')

const { filteredDocuments } = useFolder(workspace.childDocs, searchQuery)
function changeOrder (event) {
  workspace.updateCurrentDocChildOrder(filteredDocuments.value.map(doc => doc._id))
}

</script>

<template>
  <draggable
    v-model="filteredDocuments"
    :delay="110"
    :delay-on-touch-only="true"
    item-key="_id"
    class="pr-2 pb-32 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    @end="changeOrder"
  >
    <template #item="{element}">
      <WidgetPreview :doc="element" />
    </template>
  </draggable>
</template>
