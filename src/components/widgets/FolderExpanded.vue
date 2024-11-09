<script setup>
import WidgetPreview from '@/components/WidgetPreview.vue'
import useFolder from '@/composables/useFolder.js'
import { inject } from 'vue'
import draggable from 'vuedraggable'
import { Doc } from '@/classes/Doc.js'

const workspace = inject('workspace')
const searchQuery = inject('searchQuery')

defineEmits(['update-value'])
defineProps({
  doc: {
    type: Doc,
    required: true
  }
})

const { folderDocuments, widgetDocuments } = useFolder(workspace.childDocs, searchQuery)
function changeOrder (event) {
  const childDocs = folderDocuments.value.concat(widgetDocuments.value)
  workspace.updateCurrentDocChildOrder(childDocs.map(doc => doc._id))
}

</script>

<template>
  <draggable
    v-model="folderDocuments"
    :delay="110"
    :delay-on-touch-only="true"
    item-key="_id"
    group="folder"
    class="pr-2 pb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-8"
    @end="changeOrder"
  >
    <template #item="{element}">
      <WidgetPreview :doc="element" />
    </template>
  </draggable>
  <draggable
    v-model="widgetDocuments"
    :delay="110"
    :delay-on-touch-only="true"
    item-key="_id"
    group="widgets"
    class="pr-2 pb-32 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    @end="changeOrder"
  >
    <template #item="{element}">
      <WidgetPreview :doc="element" />
    </template>
  </draggable>
</template>
