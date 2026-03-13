<script setup lang="ts">
import DocRoute from '@/components/DocRoute.vue'
import WidgetList from '@/components/v4/WidgetList.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Workspace, Widget, WidgetRoute } from '@/domain'

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
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Breadcrumb -->
    <div class="px-4 pt-4 pb-2 shrink-0">
      <DocRoute v-if="currentRoute?.length" :route="currentRoute" :workspace="workspace" />
    </div>

    <!-- Widget list — remounted on widget change so subscriptions refresh -->
    <div class="flex-1 overflow-y-auto px-3 pb-32">
      <WidgetList
        v-if="expandedWidget"
        :key="expandedWidget.docId"
        :widget="expandedWidget"
        :workspace="workspace"
      />
    </div>
  </div>
</template>
