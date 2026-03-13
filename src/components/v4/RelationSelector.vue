<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import { useWidgetRelations } from '@/composables/useWidgetRelations'

const props = defineProps<{
  selectedRelation: string | null
}>()

const emit = defineEmits<{
  select: [relation: string | null]
  open: []
  close: []
}>()

const { searchRelations } = useWidgetRelations()

const popoverRef = ref()
const searchQuery = ref('')
const searchInputRef = ref()

const matches = computed(() => searchRelations(searchQuery.value))

const hasExactMatch = computed(() =>
  matches.value.some((r) => r.toLowerCase() === searchQuery.value.trim().toLowerCase())
)

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

function selectRelation(relation: string) {
  emit('select', relation)
  popoverRef.value?.hide()
}

function createRelation() {
  const value = searchQuery.value.trim()
  if (value) {
    emit('select', value)
    popoverRef.value?.hide()
  }
}

function clearRelation() {
  emit('select', null)
  popoverRef.value?.hide()
}

function handleSearchKeydown(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Enter') {
    if (matches.value.length > 0 && !showCreate.value) {
      selectRelation(matches.value[0])
    } else if (showCreate.value) {
      createRelation()
    }
  }
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popoverRef" @show="onShow" @hide="onHide">
    <div class="flex flex-col gap-2" style="width: 13rem">
      <InputText
        ref="searchInputRef"
        v-model="searchQuery"
        placeholder="Search or create..."
        size="small"
        fluid
        @keydown="handleSearchKeydown"
      />

      <ul class="flex flex-col">
        <!-- Existing matches -->
        <li
          v-for="relation in matches"
          :key="relation"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors"
          :class="
            relation === selectedRelation
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-surface-100 dark:hover:bg-surface-700'
          "
          @mousedown.prevent="selectRelation(relation)"
        >
          <i class="bi bi-tag text-xs text-surface-400" />
          <span class="text-sm">{{ relation }}</span>
        </li>

        <!-- Create new -->
        <li
          v-if="showCreate"
          class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors text-primary"
          @mousedown.prevent="createRelation"
        >
          <i class="bi bi-plus text-sm" />
          <span class="text-sm">Create "{{ searchQuery.trim() }}"</span>
        </li>

        <!-- Empty state -->
        <li
          v-if="!matches.length && !showCreate"
          class="text-xs text-surface-400 px-2 py-1.5 italic"
        >
          No relations yet
        </li>
      </ul>

      <!-- Clear -->
      <button
        v-if="selectedRelation"
        class="text-xs text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 text-left px-2 py-1 transition-colors"
        @mousedown.prevent="clearRelation"
      >
        Clear relation
      </button>
    </div>
  </Popover>
</template>
