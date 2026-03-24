<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import type { TagDocStructure } from '@/domain/interfaces/TagDocStructure'

const props = defineProps<{
  selectedTags: string[]
  availableTags: TagDocStructure[]
}>()

const emit = defineEmits<{
  add: [tagId: string]
  remove: [tagId: string]
  open: []
  close: []
}>()

const popoverRef = ref()
const searchQuery = ref('')
const searchInputRef = ref()

function sanitize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '')
}

function labelToId(label: string): string {
  return label.trim().replace(/\s+/g, '_')
}

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.availableTags
  return props.availableTags.filter((t) => t.label.includes(q))
})

const hasExactMatch = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return props.availableTags.some((t) => t.label === q)
})

const showCreate = computed(() => searchQuery.value.trim() && !hasExactMatch.value)

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

function onShow() {
  emit('open')
  nextTick(() => searchInputRef.value?.$el?.focus())
}

function onHide() {
  emit('close')
  searchQuery.value = ''
}

function handleSearchInput(e: Event) {
  searchQuery.value = sanitize((e.target as HTMLInputElement).value)
}

function toggleTag(tag: TagDocStructure) {
  const tagId = labelToId(tag.label)
  if (props.selectedTags.includes(tagId)) {
    emit('remove', tagId)
  } else {
    emit('add', tagId)
  }
}

function createTag() {
  const label = searchQuery.value.trim()
  if (!label) return
  emit('add', labelToId(label))
  searchQuery.value = ''
}

function handleSearchKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Enter') {
    if (showCreate.value) {
      createTag()
    } else if (filtered.value.length > 0) {
      toggleTag(filtered.value[0])
    }
  }
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popoverRef" @show="onShow" @hide="onHide">
    <div class="flex flex-col gap-2" style="width: 14rem">
      <InputText
        ref="searchInputRef"
        :value="searchQuery"
        placeholder="Search or create tag..."
        size="small"
        fluid
        @input="handleSearchInput"
        @keydown="handleSearchKeydown"
      />

      <ul class="flex flex-col">
        <!-- Existing tags -->
        <li
          v-for="tag in filtered"
          :key="tag._id"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-surface-100 dark:hover:bg-surface-700"
          @mousedown.prevent="toggleTag(tag)"
        >
          <i
            :class="
              selectedTags.includes(labelToId(tag.label))
                ? 'bi bi-check2 text-primary'
                : 'bi bi-tag text-surface-400'
            "
            class="text-xs shrink-0"
          />
          <span class="text-sm">{{ tag.label }}</span>
        </li>

        <!-- Create new -->
        <li
          v-if="showCreate"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-primary"
          @mousedown.prevent="createTag"
        >
          <i class="bi bi-plus text-sm shrink-0" />
          <span class="text-sm">Create "{{ searchQuery.trim() }}"</span>
        </li>

        <!-- Empty state -->
        <li
          v-if="!filtered.length && !showCreate"
          class="text-xs text-surface-400 px-2 py-1.5 italic"
        >
          No tags yet
        </li>
      </ul>
    </div>
  </Popover>
</template>
