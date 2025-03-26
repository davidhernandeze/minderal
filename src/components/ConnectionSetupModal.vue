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

watch(isOpen, (value) => {
  if (!value) emits('close')
})
</script>
<template>
  <Dialog v-model:visible="isOpen" header="Connection Setup" modal>
    <form @submit.prevent="addConnection">
      <div class="text-sm my-2">
        If local database doesn't exists, it will be created automatically.
      </div>

      <TextInput v-model="form.name" :disabled="isEdition" label="Database Name" />

      <div v-show="!isEdition" class="flex items-center gap-2 my-2">
        <ToggleSwitch v-model:model-value="isRemoteConnection" label="Remote connection" />
        <label for="">Remote Connection</label>
      </div>

      <div v-show="isRemoteConnection">
        <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          <TextInput v-model="form.host" :disabled="isEdition" label="Host" class="sm:col-span-4" />
          <TextInput
            v-model="form.username"
            :disabled="isEdition"
            label="User"
            class="sm:col-span-3"
          />
          <TextInput
            v-show="!isEdition"
            v-model="form.password"
            label="Password"
            type="password"
            class="sm:col-span-3"
          />
        </div>
      </div>
      <p v-show="error" class="text-red-500 text-sm my-4">
        Error: Failed to connect to specified database
      </p>
      <div v-if="!isEdition" class="mt-4">
        <Button type="submit">Connect</Button>
      </div>
      <div v-else class="mt-4 flex gap-4">
        <Button v-if="!isRemoteConnection" severity="danger" @click="deleteDatabase">
          <i class="bi-exclamation-triangle-fill mr-2" />
          Delete Database
        </Button>
        <Button severity="warn" @click="removeConnection"> Disconnect</Button>
      </div>
    </form>
  </Dialog>
</template>
