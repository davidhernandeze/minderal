<script setup>
import { ref, inject, watch, computed } from 'vue'
import { Doc } from '@/classes/Doc.js'
import GenericButton from '@/components/GenericButton.vue'
import WidgetExpanded from '@/components/WidgetExpanded.vue'
import Dialog from 'primevue/dialog'

const props = defineProps({
  doc: {
    type: Doc,
    required: true
  }
})
const isOpen = defineModel('isOpen', { type: Boolean })

const workspace = inject('workspace')
const versions = ref([])
const versionedDoc = ref({})
const selectedVersion = computed(() => versions.value[currentVersionIndex.value])

const currentVersionIndex = ref(0)
const hasNextVersion = computed(() => currentVersionIndex.value < versions.value.length - 1)
const hasPreviousVersion = computed(() => currentVersionIndex.value > 0)

watch(isOpen, async (value) => {
  if (value) {
    currentVersionIndex.value = 0
    versionedDoc.value = {}
    versions.value = []
    await fetchVersions()
    await getDocOnVersion(selectedVersion.value)
  }
})

async function fetchVersions() {
  versions.value = await workspace.fetchDocRevisions(props.doc._id)
}

async function getDocOnVersion(version) {
  versionedDoc.value = await workspace.getDocOnRevision(props.doc._id, version)
}

async function navigateToNextVersion() {
  if (!hasNextVersion.value) return
  currentVersionIndex.value++
  await getDocOnVersion(selectedVersion.value)
}

async function navigateToPreviousVersion() {
  if (!hasPreviousVersion.value) return
  currentVersionIndex.value--
  await getDocOnVersion(selectedVersion.value)
}

async function restoreVersion() {
  await workspace.updateDoc(props.doc, {
    name: versionedDoc.value.name,
    content: versionedDoc.value.content,
    widget: versionedDoc.value.widget
  })
  isOpen.value = false
}
</script>

<template>
  <Dialog v-model:visible="isOpen" header="Version history" modal :style="{ width: '35rem' }">
    <div v-if="selectedVersion">
      <div class="mb-4">
        <h2 class="text-xl font-bold truncate">Version {{ selectedVersion.split('-')[0] }}</h2>
        <span v-if="currentVersionIndex === 0">(current)</span>
      </div>
      <div class="flex justify-between mb-4">
        <GenericButton
          class="bg-gray-900 mt-6"
          :disabled="!hasPreviousVersion"
          @click="navigateToPreviousVersion"
        >
          Previous Version
        </GenericButton>
        <GenericButton
          class="bg-gray-900 mt-6"
          :disabled="!hasNextVersion"
          @click="navigateToNextVersion"
        >
          Next Version
        </GenericButton>
      </div>
      <div v-if="versionedDoc._id" class="overflow-y-auto relative">
        <div class="absolute bg-transparent w-full h-full z-99"></div>
        <p class="text-lg"><span class="font-bold">Name: </span>{{ versionedDoc.name }}</p>
        <WidgetExpanded :doc="versionedDoc" />
      </div>
      <GenericButton
        v-if="currentVersionIndex !== 0"
        class="bg-indigo-600 hover:bg-indigo-500 mt-6"
        type="submit"
        @click="restoreVersion"
      >
        Restore
      </GenericButton>
    </div>
  </Dialog>
</template>
