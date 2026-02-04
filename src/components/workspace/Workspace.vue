<script setup lang="ts">
import { ref, watch } from 'vue'
import DocRoute from '@/components/DocRoute.vue'
import { useMagicKeys } from '@vueuse/core'
import WidgetExpanded from '@/components/WidgetExpanded.vue'
import WidgetForm from '@/components/WidgetForm.vue'
import ProgressSpinner from 'primevue/progressspinner'
import Panel from 'primevue/panel'
import Dialog from 'primevue/dialog'
import { Workspace, Widget, WidgetRoute } from '@/domain'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import WidgetButtonBar from '@/components/workspace/WidgetButtonBar.vue'

const { workspace } = defineProps<{
  workspace: Workspace
}>()

const expandedWidget = useReactiveObjectProp<Workspace, Widget>(
  workspace,
  (w) => w.expandedWidget,
  'expandedWidget:changed'
)
const currentRoute = useReactiveObjectProp<Workspace, WidgetRoute>(
  workspace,
  (w) => w.expandedWidget?.route,
  'expandedWidget:changed'
)

const widgetFormModalOpen = ref(false)
const searchInput = ref(null)
const searchQuery = ref('')
watch(searchQuery, (v) => {
  workspace.setFilter(v)
})

const keys = useMagicKeys()
const shiftCtrlA = keys['Ctrl+K']

watch(shiftCtrlA, (v) => {
  if (!v) return
  searchInput.value.focus()
})

let widgetOnEdit: Widget | null = null
async function openCreateWidgetModal(widgetKey: string) {
  widgetOnEdit = await workspace.widgetFactory.createFromRequest({
    parent_id: workspace.docId,
    widget: widgetKey,
    content: ''
  })
  widgetFormModalOpen.value = true
}
</script>

<template>
  <Panel
    pt:root:class="h-full !rounded-none !border-none flex flex-col !bg-transparent"
    pt:content-container:class="h-full min-h-0 flex-1 flex flex-col"
    pt:content:class="relative h-full flex flex-col !pb-0 p-6 !pr-0 overflow-visible !rounded-t-none"
  >
    <div v-if="offline" class="mb-2 p-1 text-xs text-center bg-red-500/50">Offline</div>
    <div class="absolute right-[1rem] top-[1rem] z-99">
      <ProgressSpinner
        v-show="isLoading"
        style="width: 30px; height: 30px"
        stroke-width="8"
        fill="transparent"
        animation-duration="0.6s"
        aria-label="Custom ProgressSpinner"
      />
    </div>
    <div class="grow-0 z-10 mb-2">
      <div class="flex items-center">
        <DocRoute v-if="currentRoute" :route="currentRoute" :workspace="workspace" />
      </div>
      <WidgetButtonBar :workspace="workspace" class="mb-6" @select="openCreateWidgetModal" />
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="border-none bg-transparent p-1 pl-0 focus:outline-hidden outline-hidden w-full rounded-sm focus:ring-0 text-2xl mb-2"
        type="text"
        placeholder="Filter..."
      />
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto pb-[10rem]">
      <WidgetExpanded v-if="expandedWidget" :key="expandedWidget.docId" :widget="expandedWidget" />
    </div>
    <!--    <SelectWidgetModal-->
    <!--      :open-modal="isTypesModalOpen"-->
    <!--      @close="isTypesModalOpen = false"-->
    <!--      @select="selectWidget"-->
    <!--    />-->
    <Dialog
      v-model:visible="widgetFormModalOpen"
      :header="`${widgetOnEdit?.saved ? 'Edit' : 'New'} ${widgetOnEdit?.label}`"
      modal
      style="width: 40rem"
    >
      <WidgetForm
        v-if="widgetFormModalOpen"
        :key="widgetOnEdit.docId"
        :widget="widgetOnEdit"
        @save="widgetFormModalOpen = false"
      />
    </Dialog>
  </Panel>
</template>
