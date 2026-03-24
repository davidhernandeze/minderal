<script setup lang="ts">
import DocRoute from '@/components/DocRoute.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Workspace, Widget, WidgetRoute } from '@/domain'
import WidgetExpanded from '@/components/WidgetExpanded.vue'
import Popover from 'primevue/popover'
import GhostWidget from '@/components/GhostWidget.vue'
import { ref, useTemplateRef } from 'vue'

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

const parentEditPopover = useTemplateRef('parentEditPopover')

const expandedWidgetName = useReactiveObjectProp<Workspace, string>(
  workspace,
  (w) => w.expandedWidget?.getName() ?? '',
  'expandedWidget:changed'
)
const isEditingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)

function startTitleEdit() {
  isEditingTitle.value = true
}

async function endTitleEdit() {
  if (!isEditingTitle.value) return
  isEditingTitle.value = false
  await expandedWidget.value.rename(expandedWidgetName.value)
}

function handleTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLElement).blur()
}
</script>

<template>
  <div class="flex flex-col h-full px-4 lg:px-8 py-2 mx-auto max-w-lg">
    <!-- Breadcrumb -->
    <div v-show="currentRoute?.length" class="shrink-0 mx-auto w-full max-w-2xl xl:max-w-3xl">
      <DocRoute :route="currentRoute" :workspace="workspace" />
    </div>

    <div class="flex-1 overflow-y-auto pb-32 pt-2">
      <div class="mx-auto w-full max-w-2xl xl:max-w-3xl">
        <div :key="expandedWidget.docId" class="flex gap-2 items-center px-1 mb-1">
          <button @click="parentEditPopover.toggle">
            <i :class="expandedWidget.getIcon()" class="mr-2 text-2xl" />
          </button>
          <input
            ref="titleInputRef"
            v-model="expandedWidgetName"
            class="w-full bg-transparent border-none !outline-none text-3xl lg:text-4xl xl:text-5xl font-bold placeholder-surface-300 dark:placeholder-surface-600 cursor-text p-0"
            placeholder="Untitled"
            @focus="startTitleEdit"
            @blur="endTitleEdit"
            @keydown="handleTitleKeydown"
          />
          <Popover ref="parentEditPopover" :dismissable="false" class="w-full md:w-72">
            <GhostWidget
              :workspace="workspace"
              :edit-widget="expandedWidget"
              @saved="parentEditPopover.toggle()"
              @discard="parentEditPopover.toggle()"
            />
          </Popover>
        </div>
        <WidgetExpanded
          v-if="expandedWidget"
          :key="expandedWidget.docId"
          :widget="expandedWidget"
          :workspace="workspace"
        />
      </div>
    </div>
  </div>
</template>
