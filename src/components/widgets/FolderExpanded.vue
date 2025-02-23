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
    required: false,
  },
})

const { folderDocuments, widgetDocuments } = useFolder(workspace.childDocs, searchQuery)
const dragDisabled = ref(true)

function changeOrder() {
  dragDisabled.value = true
  const childDocs = folderDocuments.value.concat(widgetDocuments.value)
  workspace.updateCurrentDocChildOrder(childDocs.map((doc) => doc._id))
}

function startFolderDrag(event) {
  dragDocStore.startDragging(folderDocuments.value[event.oldIndex])
}

function startWidgetDrag(event) {
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
    class="pr-6 pb-8 grid auto-rows-[6rem] sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4"
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
    class="pr-6 pb-32 grid auto-rows-[14rem] sm:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4"
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
