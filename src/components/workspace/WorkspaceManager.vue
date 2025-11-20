<script setup lang="ts">
import Workspace from '@/components/workspace/Workspace.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { Application, Tab } from '@/domain'
import { inject } from 'vue'

const app = inject<Application>('app')
const tabs = useReactiveObjectProp<Application, Tab[]>(app, (a) => a.getTabs(), 'tabs:changed')
const activeTabId = useReactiveObjectProp<Application, string | null>(
  app,
  (a) => a.activeTabId,
  'tabs:changed'
)
</script>

<template>
  <div>
    <Workspace
      v-for="tab in tabs"
      v-show="tab.id === activeTabId"
      :key="tab.id"
      :workspace="tab.workspace"
    />
  </div>
</template>
