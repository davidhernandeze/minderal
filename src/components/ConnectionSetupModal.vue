<script setup>
import { ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'
import SwitchInput from '@/components/SwitchInput.vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import { useMetadataStore } from '@/stores/MetadataStore.js'

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
const isRemoteConnection = ref(false)
const isEdition = ref(false)
const connectionId = ref()
resetForm()

async function addConnection () {
  const localForm = form.value
  if (isRemoteConnection.value) {
    await metadataStore.addConnection(localForm.name, localForm.host, localForm.username, localForm.password)
  } else {
    await metadataStore.addConnection(localForm.name)
  }
  isOpen.value = false
}

async function removeConnection () {
  await metadataStore.removeConnection(connectionId.value)
  isOpen.value = false
}

async function deleteDatabase () {
  await metadataStore.deleteDatabase(connectionId.value)
  isOpen.value = false
}

watch(() => props.openModal, (value) => {
  if (!value) {
    resetForm()
  } else {
    isOpen.value = true
  }
})

function resetForm () {
  form.value = { host: 'https://db.minderal.com' }
  isRemoteConnection.value = false
}

watch(() => props.connection, (value) => {
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
})

watch(isOpen, (value) => {
  if (!value) emits('close')
})

</script>
<template>
  <Modal
    v-model:is-open="isOpen"
  >
    <template #body>
      <form
        class="text-gray-200 text-xl "
        @submit.prevent="addConnection"
      >
        <h1 class="mb-1">
          Connection Setup
        </h1>
        <div class="text-sm">
          If local database doesn't exists, it will be created automatically.
        </div>
        <TextInput
          v-model:value="form.name"
          :disabled="isEdition"
          label="Database Name"
          type="text"
          class="my-3 w-full"
        />
        <SwitchInput
          v-show="!isEdition"
          v-model:model-value="isRemoteConnection"
          class="my-2"
          label="Remote connection"
        />

        <div v-show="isRemoteConnection">
          <div class="mt-6 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
            <TextInput
              v-model:value="form.host"
              :disabled="isEdition"
              label="Host"
              type="text"
              class="sm:col-span-4"
            />
            <TextInput
              v-model:value="form.username"
              :disabled="isEdition"
              label="User"
              type="text"
              class="sm:col-span-3"
            />
            <TextInput
              v-show="!isEdition"
              v-model:value="form.password"
              label="Password"
              type="password"
              class="sm:col-span-3"
            />
          </div>
        </div>
        <div v-if="!isEdition">
          <GenericButton
            class="bg-indigo-600 hover:bg-indigo-500 mt-6"
            type="submit"
          >
            Connect
          </GenericButton>
        </div>
        <div v-else>
          <GenericButton
            v-if="!isRemoteConnection"
            class="bg-transparent border-none hover:bg-red-500 mt-6 focus:ring-0 focus:outline-none mr-2"
            @click="deleteDatabase"
          >
            <i class="fa-solid fa-triangle-exclamation h-3 mr-2" />
            Delete Database
          </GenericButton>
          <GenericButton
            class="bg-transparent border-none hover:bg-red-500 mt-6 focus:ring-0 focus:outline-none"
            @click="removeConnection"
          >
            Disconnect
          </GenericButton>
        </div>
      </form>
    </template>
  </Modal>
</template>
