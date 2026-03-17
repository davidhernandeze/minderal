<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import WidgetListItem from './WidgetListItem.vue'
import GhostWidget from './GhostWidget.vue'
import WidgetTypeSelector from './WidgetTypeSelector.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import type { Widget } from '@/domain/Widget'
import type { Workspace } from '@/domain'

const { widget, workspace } = defineProps<{
  widget: Widget
  workspace: Workspace
}>()

const selectedWidgetId = ref<string | null>(null)

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

// Default widget type for new items — stored in settings, fallback to 'text'
const settings = computed(() => widget.doc.settings as Record<string, any>)
const defaultTypeKey = ref<string>((settings.value.defaultWidgetType as string) ?? 'text')

const allTypes = computed(() => workspace.getWidgetTypes())
const { sortByUsage } = useWidgetUsage()
const sortedTypes = computed(() => sortByUsage(allTypes.value))

const defaultTypeLabel = computed(
  () => allTypes.value.find((t) => t.key === defaultTypeKey.value)?.label ?? 'Text'
)

const defaultTypeSelectorRef = ref()

function openDefaultTypeSelector(event: Event) {
  defaultTypeSelectorRef.value?.toggle(event)
}

async function onDefaultTypeSelect(key: string) {
  defaultTypeKey.value = key
  ;(widget.doc.settings as Record<string, any>).defaultWidgetType = key
  await widget.db.updateDoc(widget.doc)
}

// Ghost
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
  <div class="px-1 mb-1">
    <input
      ref="titleInputRef"
      v-model="widgetName"
      class="w-full bg-transparent border-none !outline-none text-3xl lg:text-4xl xl:text-5xl font-bold placeholder-surface-300 dark:placeholder-surface-600 cursor-text p-0"
      placeholder="Untitled"
      @focus="startTitleEdit"
      @blur="endTitleEdit"
      @keydown="handleTitleKeydown"
    />
  </div>

  <!-- Default type label -->
  <div
    class="px-1 mb-5 flex items-center gap-1 text-sm lg:text-base text-surface-400 dark:text-surface-500"
  >
    <span>List of</span>
    <button
      class="text-surface-500 dark:text-surface-400 hover:text-primary dark:hover:text-primary underline underline-offset-2 decoration-dashed transition-colors"
      @click="openDefaultTypeSelector"
    >
      {{ defaultTypeLabel }}
    </button>
    <WidgetTypeSelector
      ref="defaultTypeSelectorRef"
      :types="sortedTypes"
      :selected-key="defaultTypeKey"
      @select="onDefaultTypeSelect"
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
      <WidgetListItem
        v-for="child in children"
        :key="child.docId"
        :widget="child"
        :is-selected="selectedWidgetId === child.docId"
        @select="selectedWidgetId = child.docId"
      />
    </TransitionGroup>

    <!-- Ghost widget or add button -->
    <div class="mt-2">
      <GhostWidget
        v-if="ghostActive"
        :workspace="workspace"
        :default-type-key="defaultTypeKey"
        @saved="onGhostSaved"
        @discard="onGhostDiscard"
      />
      <button
        v-else
        class="flex items-center gap-2 w-full px-3 py-2 cursor-pointer text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        @click="activateGhost"
      >
        <i class="bi bi-plus text-base" />
        <span>Add item</span>
      </button>
    </div>
  </div>
</template>

<style>
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
