<script setup>
import { useMetadataStore } from '@/stores/MetadataStore.js'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import Select from 'primevue/select'
import Card from 'primevue/card'
import { onKeyStroke, useDocumentVisibility } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import WidgetSearch from '@/components/WidgetSearch.vue'

const metadataStore = useMetadataStore()
const { connections } = storeToRefs(metadataStore)

onKeyStroke(['Escape'], (e) => {
  e.preventDefault()
  hideMindbar()
})


function hideMindbar() {
  invoke('hide_mindbar')
}

const selectedConnection = ref({})
watch(connections, (value) => {
  if (value.length > 0) {
    selectedConnection.value = value[0]
  }
})

</script>

<template>
  <div class="h-screen shadow-2xl select-none">
    <Card class="h-full">
      <template #content>
        <div
          class="absolute top-[0.5rem] right-[0.8rem] flex items-center cursor-pointer font-bold"
          @click="hideMindbar"
        >
          <i
            data-tauri-drag-region
            class="bi bi-record-circle cursor-pointer mr-4"
            @pointerdown="invoke('lock_mindbar')"
          />
          <span class="text-xs mr-1">ESC</span>
          <i class="text-xl bi bi-x" />
        </div>
        <div class="mb-2">
          <i class="bi bi-database mr-2" />
          <Select
            v-model="selectedConnection"
            :options="connections"
            size="small"
            optionLabel="name"
            placeholder="Select a database"
            class="w-[12rem]"
          />
        </div>
        <div v-if="selectedConnection.id">
          <WidgetSearch :key="selectedConnection.id" :connection-id="selectedConnection.id" />
        </div>
      </template>
    </Card>
  </div>
</template>
