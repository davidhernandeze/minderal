<script setup>
import { ref, watch } from 'vue'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { useMetadataStore } from '@/stores/MetadataStore.js'
import Dialog from 'primevue/dialog'
import TextInput from '@/components/TextInput.vue'

const emits = defineEmits(['close', 'select'])
const props = defineProps({
  openModal: {
    required: true,
    type: Boolean
  },
  connection: {
    default: null,
    type: Object
  }
})

const isOpen = ref(props.openModal)

const metadataStore = useMetadataStore()
const form = ref({})
const error = ref(false)
const isRemoteConnection = ref(false)
const isEdition = ref(false)
const connectionId = ref()
resetForm()

async function addConnection() {
  error.value = false
  try {
    const localForm = form.value
    if (isRemoteConnection.value) {
      await metadataStore.addConnection(
        localForm.name,
        localForm.host,
        localForm.username,
        localForm.password
      )
    } else {
      await metadataStore.addConnection(localForm.name)
    }
    isOpen.value = false
  } catch (e) {
    console.log(e)
    error.value = true
  }
}

async function removeConnection() {
  await metadataStore.removeConnection(connectionId.value)
  isOpen.value = false
}

async function deleteDatabase() {
  await metadataStore.deleteDatabase(connectionId.value)
  isOpen.value = false
}

watch(
  () => props.openModal,
  (value) => {
    if (!value) {
      resetForm()
    } else {
      isOpen.value = true
    }
  }
)

function resetForm() {
  form.value = { host: 'https://db.minderal.com' }
  isRemoteConnection.value = false
}

watch(
  () => props.connection,
  (value) => {
    isEdition.value = !!value
    form.value.name = value?.name
    if (value) {
      connectionId.value = value.id
      if (value.host) {
        isRemoteConnection.value = true
        form.value.host = value.host
        form.value.username = value.connectionOptions?.auth?.username
      }
    }
  }
)
</script>
<template>
  <Dialog v-model:visible="isOpen" header="Connection Setup" modal>
    <div class="w-[90vw] h-[80vh]">
      hello
    </div>
  </Dialog>
</template>
