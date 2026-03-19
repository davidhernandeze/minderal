<script setup lang="ts">
import { ref, computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InvisibleInput from '@/components/InvisibleInput.vue'
import WidgetMenu from '@/components/WidgetMenu.vue'
import WidgetInlinePreview from './WidgetInlinePreview.vue'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import type { Widget } from '@/domain/Widget'

const { widget, isSelected } = defineProps<{ widget: Widget; isSelected?: boolean }>()
const emit = defineEmits<{ select: []; edit: [] }>()

const widgetName = useReactiveObjectProp<Widget, string>(widget, (w) => w.getName(), 'name:changed')
const tags = useReactiveObjectProp<Widget, string[]>(widget, (w) => w.getTags(), 'content:changed')
const isEditingName = ref(false)
const menuEvent = ref<Event | null>(null)

const icon = computed(() => widget.getIcon())

// Tag editing state
const focusedTagId = ref<string | null>(null)
const editingTagValue = ref('')

function tagIdToLabel(id: string): string {
  return id.replace(/_/g, ' ')
}

function labelToTagId(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '_')
}

function focusTag(tagId: string) {
  focusedTagId.value = tagId
  editingTagValue.value = tagIdToLabel(tagId)
}

function blurTag(tagId: string) {
  if (focusedTagId.value !== tagId) return
  commitTagEdit(tagId)
}

async function commitTagEdit(oldTagId: string) {
  const newLabel = editingTagValue.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
  const newTagId = labelToTagId(newLabel)
  focusedTagId.value = null

  const currentTags = widget.getTags()
  if (!newLabel || newTagId === oldTagId) return

  const updated = currentTags.map((t) => (t === oldTagId ? newTagId : t))
  await widget.updateTags(updated)
  await widget.db.createOrUpdateTagDoc(newLabel)
}

async function deleteTag(tagId: string) {
  focusedTagId.value = null
  const updated = widget.getTags().filter((t) => t !== tagId)
  await widget.updateTags(updated)
}

function handleTagKeydown(e: KeyboardEvent, tagId: string) {
  e.stopPropagation()
  if (e.key === 'Enter') (e.target as HTMLElement).blur()
  if (e.key === 'Escape') {
    focusedTagId.value = null
    editingTagValue.value = ''
  }
}

function handleTagInput(e: Event) {
  editingTagValue.value = (e.target as HTMLInputElement).value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
  ;(e.target as HTMLInputElement).value = editingTagValue.value
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
  <Panel
    pt:content:class="group flex items-center gap-3 !p-0 rounded-lg dark:hover:shadow-sm transition-colors cursor-default border-none"
    pt:header:class="!hidden"
    pt:root:class="!border-0"
    @click="emit('select')"
  >
    <!-- Icon -->
    <button class="cursor-pointer" @click="emit('edit')">
      <i
        v-if="!widget.hideIcon"
        :class="icon"
        class="text-base text-surface-400 shrink-0 self-center"
      />
    </button>

    <!-- Content: name descriptor + content preview -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Name (small descriptor, editable) -->
      <InvisibleInput
        v-if="widget.getName() && !widget.standalonePreview"
        v-model:value="widgetName"
        class="text-[0.55rem] tracking-widest uppercase font-semibold text-surface-400 min-w-0 truncate leading-none mb-0.5"
        placeholder="_"
        @focus="startNameEdit"
        @blur="endNameEdit"
        @keydown="handleNameKeydown"
      />

      <!-- Content preview row -->
      <div class="flex justify-start gap-2 min-w-0">
        <WidgetInlinePreview :widget="widget" />
      </div>
    </div>

    <!-- Tags -->
    <div v-if="tags.length" class="flex items-center gap-1 shrink-0" @click.stop>
      <div v-for="tagId in tags" :key="tagId" class="relative flex items-center">
        <!-- Focused: editable input + delete button -->
        <template v-if="focusedTagId === tagId">
          <div class="flex items-center gap-0.5 bg-primary/10 rounded-full px-2 py-0.5">
            <input
              :value="editingTagValue"
              class="text-xs text-primary bg-transparent outline-none w-16 min-w-0"
              @input="handleTagInput"
              @blur="blurTag(tagId)"
              @keydown="(e) => handleTagKeydown(e, tagId)"
            />
            <button
              class="text-primary hover:text-red-500 transition-colors ml-0.5"
              @mousedown.prevent="deleteTag(tagId)"
            >
              <i class="bi bi-x text-xs" />
            </button>
          </div>
        </template>

        <!-- Normal: PrimeVue Tag chip -->
        <template v-else>
          <Tag
            :value="tagIdToLabel(tagId)"
            severity="secondary"
            size="sm"
            class="cursor-pointer !text-xss"
            @click.stop="focusTag(tagId)"
          />
        </template>
      </div>
    </div>

    <!-- Menu -->
    <Button
      icon="bi bi-three-dots-vertical"
      variant="text"
      size="small"
      class="!p-1 shrink-0 transition-opacity px-0 !w-auto"
      :class="isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      @click.stop="
        (e) => {
          menuEvent = e
          emit('select')
        }
      "
    />
    <WidgetMenu v-model:event="menuEvent" :widget="widget" :on-edit="() => emit('edit')" />
  </Panel>
</template>
