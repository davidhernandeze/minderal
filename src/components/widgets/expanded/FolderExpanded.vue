<script setup lang="ts">
import WidgetPreview from '@/components/WidgetPreview.vue'
import { ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import dragDocStore from '@/stores/dragDoc.js'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp.js'
import { Widget } from '@/domain'
import FolderWidget from '@/domain/widgets/FolderWidget'

defineEmits(['update-value'])
const props = defineProps<{ widget: FolderWidget }>()

const childrenWidgets = useReactiveObjectProp<FolderWidget, Widget[]>(
  props.widget,
  (widget) => widget.getChildren(),
  'children:changed'
)
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
  <!--  <VueDraggable-->
  <!--    v-show="folderDocuments.length > 0"-->
  <!--    v-model="folderDocuments"-->
  <!--    :disabled="dragDisabled"-->
  <!--    item-key="_id"-->
  <!--    group="folder"-->
  <!--    class="pr-6 pb-8 grid auto-rows-[6rem] sm:grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4"-->
  <!--    @start="startFolderDrag"-->
  <!--    @end="changeOrder"-->
  <!--  >-->
  <!--    <WidgetPreview-->
  <!--      v-for="document in folderDocuments"-->
  <!--      :key="document._rev"-->
  <!--      :doc="document"-->
  <!--      @enable-drag="dragDisabled = false"-->
  <!--      @disable-drag="dragDisabled = true"-->
  <!--    />-->
  <!--  </VueDraggable>-->
  <VueDraggable
    v-model="childrenWidgets"
    :disabled="dragDisabled"
    item-key="docId"
    group="widgets"
    class="pr-6 pb-32 grid auto-rows-[14rem] sm:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4"
    @start="startWidgetDrag"
    @end="changeOrder"
  >
    <WidgetPreview
      v-for="childWidget in childrenWidgets"
      :key="childWidget.docId"
      :widget="childWidget"
      @enable-drag="dragDisabled = false"
      @disable-drag="dragDisabled = true"
    />
  </VueDraggable>
</template>
