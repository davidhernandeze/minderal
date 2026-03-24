<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import GhostWidget from '@/components/GhostWidget.vue'
import WidgetTypeSelector from '@/components/WidgetTypeSelector.vue'
import CreateWidgetTypeModal from '@/components/CreateWidgetTypeModal.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { useWidgetUsage } from '@/composables/useWidgetUsage'
import type { Widget } from '@/domain/Widget'
import type { Workspace } from '@/domain'
import WidgetListItem from '@/components/WidgetListItem.vue'

const { widget, workspace } = defineProps<{
  widget: Widget
  workspace: Workspace
}>()

const selectedWidgetId = ref<string | null>(null)
const editingWidgetId = ref<string | null>(null)

const children = useReactiveObjectProp<Widget, Widget[]>(
  widget,
  (w) => w.getChildren(),
  'children:changed'
)

// Default widget type for new items — stored in settings, fallback to 'text'
const settings = computed(() => widget.doc.settings as Record<string, any>)
const defaultTypeKey = ref<string>((settings.value.children_type as string) ?? 'text')

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
  await widget.updateSetting('children_type', key)
}

// Create widget type modal
const createModalVisible = ref(false)
const createModalLabel = ref('')

function handleDefaultTypeCreate(label: string) {
  createModalLabel.value = label
  createModalVisible.value = true
}

async function handleDefaultTypeCreated(typeId: string) {
  defaultTypeKey.value = typeId
  await widget.updateSetting('children_type', typeId)
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
  <!-- Default type label -->
  <div
    class="px-1 mb-5 flex items-center gap-1 text-sm lg:text-base text-surface-400 dark:text-surface-500"
  >
    <span>List of</span>
    <button
      v-if="!settings.children_type_locked"
      class="text-surface-500 dark:text-surface-400 hover:text-primary dark:hover:text-primary underline underline-offset-2 decoration-dashed transition-colors"
      @click="openDefaultTypeSelector"
    >
      {{ defaultTypeLabel }}
    </button>
    <span v-else class="text-surface-500 dark:text-surface-400">{{ defaultTypeLabel }}</span>
    <WidgetTypeSelector
      ref="defaultTypeSelectorRef"
      :types="sortedTypes"
      :selected-key="defaultTypeKey"
      @select="onDefaultTypeSelect"
      @create="handleDefaultTypeCreate"
    />
    <CreateWidgetTypeModal
      v-model:visible="createModalVisible"
      :workspace="workspace"
      :initial-label="createModalLabel"
      @created="handleDefaultTypeCreated"
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
    <TransitionGroup name="list" tag="div" class="flex flex-col gap-4">
      <template v-for="child in children" :key="child.docId">
        <GhostWidget
          v-if="editingWidgetId === child.docId"
          :workspace="workspace"
          :edit-widget="child"
          @saved="editingWidgetId = null"
          @discard="editingWidgetId = null"
        />
        <WidgetListItem
          v-else
          :widget="child"
          :is-selected="selectedWidgetId === child.docId"
          @select="selectedWidgetId = child.docId"
          @edit="editingWidgetId = child.docId"
        />
      </template>
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
