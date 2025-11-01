<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
import Tabs from '@/components/Tabs.vue'
import WorkspaceManager from '@/components/WorkspaceManager.vue'
import sidebarStore from '@/stores/sidebar.js'
import { inject } from 'vue'
import ConfirmDialog from 'primevue/confirmdialog'
import Application from '@/domain/Application'

const app: Application = inject('app')

const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="max-h-screen h-screen flex">
    <ConfirmDialog />
    <Sidebar class="flex-none" />
    <div :class="[isSidebarVisible ? 'hidden sm:block' : 'block']" class="w-full pl-2 pr-0 pb-0">
      <div class="flex flex-col h-full">
        <Tabs class="pt-1" />
<!--        <WorkspaceManager v-show="app.tabs.length > 0" class="flex-1 overflow-y-auto" />-->
      </div>
    </div>
  </div>
</template>
