<script setup>
import { storeToRefs } from 'pinia'
import { inject, ref, watch } from 'vue'
import Select from 'primevue/select'
import Card from 'primevue/card'
import { onKeyStroke } from '@vueuse/core'
import { invoke } from '@tauri-apps/api/core'
import WidgetSearch from '@/components/WidgetSearch.vue'

const metadataStore = inject('metadataStore')
const { connections } = storeToRefs(metadataStore)

const isMindbarLocked = ref(false)

onKeyStroke(['Escape'], (e) => {
  e.preventDefault()
  hideMindbar()
})


function hideMindbar() {
  invoke('hide')
}

function toggleMindbarLock() {
  if (isMindbarLocked.value) {
    isMindbarLocked.value = false
    invoke('unlock')
  } else {
    isMindbarLocked.value = true
    invoke('lock')
  }
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
          class="absolute top-[0.5rem] right-[0.8rem] flex items-center cursor-pointer font-bold gap-4"
        >
          <i
            data-tauri-drag-region
            class="bi bi-record-circle cursor-pointer"
          />
          <i
            :class="isMindbarLocked ? 'bi-lock-fill' : 'bi-unlock-fill'"
            class="bi cursor-pointer"
            @pointerdown="toggleMindbarLock"
          />
          <button class="flex items-center cursor-pointer" @click="hideMindbar">
            <span class="text-xs">ESC</span>
            <i class="text-xl bi bi-x" />
          </button>
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
        <div class="h-full" v-if="selectedConnection.id">
          <WidgetSearch :key="selectedConnection.id" :connection-id="selectedConnection.id" />
        </div>
      </template>
    </Card>
  </div>
</template>
