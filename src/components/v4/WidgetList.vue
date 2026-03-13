<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import WidgetListItem from './WidgetListItem.vue'
import GhostWidget from './GhostWidget.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Widget } from '@/domain/Widget'
import type { Workspace } from '@/domain'

const { widget, workspace } = defineProps<{
  widget: Widget
  workspace: Workspace
}>()

const children = useReactiveObjectProp<Widget, Widget[]>(
  widget,
  (w) => w.getChildren(),
  'children:changed'
)

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')
const isEditingTitle = ref(false)
const titleInputRef = ref<HTMLInputElement | null>(null)

function startTitleEdit() {
  isEditingTitle.value = true
}

async function endTitleEdit() {
  if (!isEditingTitle.value) return
  isEditingTitle.value = false
  await widget.rename(widgetName.value)
}

function handleTitleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLElement).blur()
}

const ghostActive = ref(false)

function activateGhost() {
  ghostActive.value = true
}

function onGhostSaved() {
  ghostActive.value = false
}

function onGhostDiscard() {
  ghostActive.value = false
}
</script>

<template>
  <!-- Document title -->
  <div class="px-1 mb-4">
    <input
      ref="titleInputRef"
      v-model="widgetName"
      class="w-full bg-transparent border-none outline-none text-3xl font-bold placeholder-surface-300 dark:placeholder-surface-600 cursor-text"
      placeholder="Untitled"
      @focus="startTitleEdit"
      @blur="endTitleEdit"
      @keydown="handleTitleKeydown"
    />
  </div>

  <!-- Empty state -->
  <div
    v-if="!children?.length && !ghostActive"
    class="flex flex-col items-center justify-center h-full gap-4 text-surface-400"
  >
    <i class="bi bi-list-ul text-4xl opacity-40" />
    <p class="text-sm opacity-60">Your list is empty</p>
    <Button
      label="Add first item"
      icon="bi bi-plus"
      variant="outlined"
      size="small"
      @click="activateGhost"
    />
  </div>

  <!-- Children list -->
  <div v-else class="flex flex-col">
    <TransitionGroup name="list" tag="div" class="flex flex-col gap-0.5">
      <WidgetListItem v-for="child in children" :key="child.docId" :widget="child" />
    </TransitionGroup>

    <!-- Ghost widget or add button -->
    <div class="mt-2">
      <GhostWidget
        v-if="ghostActive"
        :workspace="workspace"
        @saved="onGhostSaved"
        @discard="onGhostDiscard"
      />
      <button
        v-else
        class="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        @click="activateGhost"
      >
        <i class="bi bi-plus text-base" />
        <span>Add item</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.list-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
