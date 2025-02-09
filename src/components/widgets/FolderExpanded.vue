<script setup>
import WidgetPreview from '@/components/WidgetPreview.vue'
import useFolder from '@/composables/useFolder.js'
import { inject, ref } from 'vue'
import { Doc } from '@/classes/Doc.js'
import { VueDraggable } from 'vue-draggable-plus'
import dragDocStore from '@/stores/dragDoc.js'

const workspace = inject('workspace')
const searchQuery = inject('searchQuery')

defineEmits(['update-value'])
defineProps({
  doc: {
    type: Doc,
    required: false
  }
})

const { folderDocuments, widgetDocuments } = useFolder(workspace.childDocs, searchQuery)
const dragDisabled = ref(true)

function changeOrder (event) {
  dragDisabled.value = true
  const childDocs = folderDocuments.value.concat(widgetDocuments.value)
  workspace.updateCurrentDocChildOrder(childDocs.map(doc => doc._id))
}

function startFolderDrag (event) {
  dragDocStore.startDragging(folderDocuments.value[event.oldIndex])
}

function startWidgetDrag (event) {
  dragDocStore.startDragging(widgetDocuments.value[event.oldIndex])
}
</script>

<template>
  <VueDraggable
    v-model="folderDocuments"
    v-show="folderDocuments.length > 0"
    :disabled="dragDisabled"
    item-key="_id"
    group="folder"
    class="pr-6 pb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-"
    @start="startFolderDrag"
    @end="changeOrder"
  >
    <WidgetPreview
      v-for="document in folderDocuments"
      :key="document._id"
      :doc="document"
      @enable-drag="dragDisabled = false"
      @disable-drag="dragDisabled = true"
    />
  </VueDraggable>
  <VueDraggable
    v-model="widgetDocuments"
    :disabled="dragDisabled"
    item-key="_id"
    group="widgets"
    class="pr-6 pb-32 grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    @start="startWidgetDrag"
    @end="changeOrder"
  >
    <WidgetPreview
      v-for="document in widgetDocuments"
      :key="document._id"
      :doc="document"
      @enable-drag="dragDisabled = false"
      @disable-drag="dragDisabled = true"
    />
  </VueDraggable>
</template>
