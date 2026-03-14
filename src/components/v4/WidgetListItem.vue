<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import InvisibleInput from '@/components/InvisibleInput.vue'
import WidgetMenu from '@/components/WidgetMenu.vue'
import RelationSelector from './RelationSelector.vue'
import WidgetInlinePreview from './WidgetInlinePreview.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { useWidgetRelations } from '@/composables/useWidgetRelations'
import type { Widget } from '@/domain/Widget'

const { widget, showRelation } = defineProps<{
  widget: Widget
  showRelation?: boolean
}>()

const { recordRelation } = useWidgetRelations()

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')
const isEditingName = ref(false)
const menuEvent = ref<Event | null>(null)
const relationSelectorRef = ref()

const icon = computed(() => widget.getWorkspace().widgetTypes.get(widget.key)?.icon ?? '')
const relation = computed(() => widget.doc.relation ?? null)

async function onRelationSelect(value: string | null) {
  widget.doc.relation = value
  await widget.db.updateDoc(widget.doc)
  if (value) recordRelation(value)
}

function startNameEdit() {
  isEditingName.value = true
}

async function endNameEdit() {
  if (!isEditingName.value) return
  isEditingName.value = false
  await widget.rename(widgetName.value)
}

function handleNameKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLElement).blur()
}
</script>

<template>
  <div
    class="group flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:shadow-sm transition-colors cursor-default"
  >
    <!-- Menu -->
    <Button
      icon="bi bi-three-dots-vertical"
      variant="text"
      size="small"
      class="!p-1 shrink-0"
      @click="(e) => (menuEvent = e)"
    />
    <WidgetMenu v-model:event="menuEvent" :widget="widget" />

    <!-- Icon -->
    <i :class="icon" class="text-base text-surface-400 shrink-0 self-center" />

    <!-- Content: relation descriptor + name -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Relation descriptor (above name) -->
      <div v-if="showRelation">
        <button
          v-if="relation !== null"
          class="group/rel inline-flex items-center gap-1 text-xs tracking-widest uppercase font-semibold transition-colors"
          :class="
            relation
              ? 'text-primary/70 hover:text-primary'
              : 'text-surface-300 dark:text-surface-600 hover:text-surface-400 dark:hover:text-surface-500'
          "
          @click="(e) => relationSelectorRef?.toggle(e)"
        >
          <span class="text-[0.5rem] max-w-24 truncate">{{ relation }}</span>
          <i class="bi bi-pencil text-[0.6rem] opacity-0 group-hover/rel:opacity-60 transition-opacity" />
        </button>
        <RelationSelector
          ref="relationSelectorRef"
          :selected-relation="relation"
          @select="onRelationSelect"
        />
      </div>

      <!-- Name + preview row -->
      <div class="flex items-center gap-2 min-w-0">
        <button
          v-if="widget.expandable"
          class="flex-1 text-sm min-w-0 text-left truncate hover:text-primary transition-colors cursor-pointer leading-snug"
          @click="widget.openInWorkspace()"
        >
          {{ widgetName }}
        </button>
        <InvisibleInput
          v-else
          v-model:value="widgetName"
          class="w-1/2 text-sm min-w-0 cursor-text leading-snug"
          @focus="startNameEdit"
          @blur="endNameEdit"
          @keydown="handleNameKeydown"
        />

        <!-- Inline preview (shares row with name) -->
        <div
          v-if="widget.previewComponent"
          class="shrink-0 w-6 h-6 rounded-full overflow-hidden"
        >
          <WidgetInlinePreview :widget="widget" />
        </div>
      </div>
    </div>

  </div>
</template>
