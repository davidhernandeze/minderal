<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import Popover from 'primevue/popover'
import InputText from 'primevue/inputtext'
import { iconList } from '@/utils/icon-list'

const props = defineProps<{
  selectedKey: string
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const popoverRef = ref()
const searchQuery = ref('')
const searchInputRef = ref()

const filteredIcons = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return iconList.slice(0, 50)
  return iconList
    .filter((icon) => icon.keywords.some((kw) => kw.startsWith(q)) || icon.key.includes(q))
    .slice(0, 50)
})

function toggle(event: Event) {
  popoverRef.value?.toggle(event)
}

function onShow() {
  nextTick(() => searchInputRef.value?.$el?.focus())
}

function onHide() {
  searchQuery.value = ''
}

function selectIcon(key: string) {
  emit('select', key)
  popoverRef.value?.hide()
}

defineExpose({ toggle })
</script>

<template>
  <Popover ref="popoverRef" @show="onShow" @hide="onHide">
    <div class="flex flex-col gap-2" style="width: 16rem">
      <InputText
        ref="searchInputRef"
        v-model="searchQuery"
        placeholder="Search icons..."
        size="small"
        fluid
        @keydown.stop
        @keydown.enter.prevent="filteredIcons[0] && selectIcon(filteredIcons[0].key)"
      />
      <div class="grid gap-1" style="grid-template-columns: repeat(8, 1fr); max-height: 14rem; overflow-y: auto">
        <button
          v-for="icon in filteredIcons"
          :key="icon.key"
          v-tooltip.top="icon.label"
          type="button"
          class="flex items-center justify-center p-1.5 rounded-md cursor-pointer transition-colors text-sm"
          :class="
            icon.key === selectedKey
              ? 'bg-primary/10 text-primary'
              : 'hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300'
          "
          @mousedown.prevent="selectIcon(icon.key)"
        >
          <i :class="`bi bi-${icon.key}`" />
        </button>
      </div>
      <p v-if="filteredIcons.length === 0" class="text-xs text-surface-400 px-1 py-1">
        No results
      </p>
    </div>
  </Popover>
</template>
