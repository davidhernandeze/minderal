<script setup>
import { getWidgetList } from '@/enums/widgets.js'
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'

const widgets = getWidgetList()

const isOpen = ref(false)

const searchTypeInput = ref(null)
const searchTypeValue = ref('')

const emits = defineEmits(['close', 'select'])
const props = defineProps({
  openModal: {
    required: true,
    type: Boolean
  }
})
watch(() => props.openModal, (value) => {
  if (value) isOpen.value = true
})

watch(isOpen, () => {
  emits('close')
  searchTypeValue.value = ''
})

const filteredWidgets = computed(() => {
  return widgets.filter((type) => {
    const searchableContent = type.index + ' ' + type.label
    return searchableContent.toLowerCase().indexOf(searchTypeValue.value.toLowerCase()) > -1
  })
})

</script>
<template>
  <Dialog
    v-model:visible="isOpen"
    modal
    header="Select Widget"
    @close="searchTypeValue = ''"
  >
    <div class="my-4">
      <div class="flex items-center px-4">
        <input
          ref="searchTypeInput"
          v-model="searchTypeValue"
          class="rounded-sm text-md p-2 w-full dark:bg-(--p-surface-900)"
          type="text"
          placeholder="Search widget..."
        >
      </div>

      <div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
        <button
          v-for="widget in filteredWidgets"
          :key="widget.index"
          class="flex items-center rounded-full p-1 px-3 hover:text-(--p-primary-500) border-transparent hover:border-(--p-primary-500) cursor-pointer text-md border"
          @click="isOpen = false; emits('select', widget); searchTypeValue = ''"
        >
          <i
            :class="widget.icon"
            class="mr-2"
          />
          {{ widget.label }}
        </button>
      </div>
    </div>
  </Dialog>
</template>
