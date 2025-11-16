<script setup lang="ts">
import sidebarStore from '@/stores/sidebar.js'
import { Application, Tab } from '@/domain'
import { inject } from 'vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'

const app = inject<Application>('app')
const tabs = useReactiveObjectProp<Application, Tab[]>(
  app,
  (a) => a.getTabs(),
  'tabs:changed'
)
const activeTabId = useReactiveObjectProp<Application, string | null>(
  app,
  (a) => a.activeTabId,
  'tabs:changed'
)

const { isSidebarVisible } = sidebarStore
</script>
<template>
  <div class="w-full flex px-2 gap-4 justify-between">
    <div class="flex-1 flex overflow-y-auto pb-2">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        class="relative p-2 rounded-t w-[11rem] flex justify-between cursor-pointer mr-0.5"
        @click="app.openTab(tab)"
      >
        <div class="w-full">
          <div class="flex items-center">
            <i class="mr-2" :class="tab.icon" />
            <p class="truncate">{{ tab.label || 'home' }}</p>
          </div>
          <p class="truncate text-xs font-light tracking-wider">@{{ tab.connectionName }}</p>
        </div>
        <div
          class="h-[1.2rem] w-[1.2rem] rounded-full flex-center hover:bg-[var(--p-surface-600)]"
          @click.stop="app.closeTab(tab)"
        >
          <i class="bi bi-x" />
        </div>
        <div
          v-if="tab.id === activeTabId"
          class="w-full bg-(--p-primary-500) h-[0.2rem] absolute bottom-[-0.14rem] left-0"
        />
      </div>
    </div>
    <div
      v-show="!isSidebarVisible"
      class="p-2 rounded-t w-8 flex-center cursor-pointer mr-0.5"
      @click="sidebarStore.showSidebar()"
    >
      <i class="text-2xl bi bi-plus" />
    </div>
  </div>
</template>
