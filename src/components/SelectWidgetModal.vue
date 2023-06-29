<template>
  <Modal
    v-model:is-open="isOpen"
    @close="searchTypeValue = ''"
  >
    <template #body>
      <div class="text-gray-50 my-4">
        <div class="flex items-center px-4">
          <input
            ref="searchTypeInput"
            v-model="searchTypeValue"
            class="text-gray-50 rounded text-md p-2 bg-gray-700 w-full"
            type="text"
            placeholder="Search widget..."
          >
        </div>

        <div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          <button
            v-for="widget in filteredWidgets"
            :key="widget.index"
            class="flex items-center rounded-full p-1 px-3 hover:bg-gray-700 cursor-pointer text-md shadow-sm"
            @click="isOpen = false; emits('select', widget); searchTypeValue = ''"
          >
            <i
              :class="widget.icon"
              class="h-3 mr-2"
            />
            {{ widget.label }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>
<script setup>
import { getWidgetList } from '@/enums/widgets.js'
import { computed, ref, watch } from 'vue'

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
