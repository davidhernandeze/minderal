<template>
  <Modal
    v-model:is-open="isOpen"
  >
    <template #body>
      <div class="text-gray-200 text-xl">
        <h1 class="mb-1">
          Connection Setup
        </h1>
        <div class="text-sm">
          If the database doesn't exists, it will be created automatically.
        </div>
        <TextInput
          v-model:value="databaseName"
          label="Database Name"
          type="text"
          class="my-3"
        />
        <SwitchInput
          v-model:model-value="isRemoteConnection"
          class="my-2"
          label="Remote connection"
        />

        <div v-show="isRemoteConnection">
          <TextInput
            v-model:value="host"
            label="Host"
            type="text"
            class="my-2"
          />
          <div class="grid grid-cols-1 sm:grid-cols-2">
            <TextInput
              v-model:value="username"
              label="User"
              type="text"
              class="my-2"
            />
            <TextInput
              v-model:value="password"
              label="Password"
              type="password"
              class="my-2"
            />
          </div>
        </div>
      </div>
      <GenericButton
        class="bg-indigo-600 hover:bg-indigo-500 mt-6"
        @click="addConnection"
      >
        Connect
      </GenericButton>
    </template>
  </Modal>
</template>
<script setup>
import { ref, watch } from 'vue'
import Modal from '@/components/Modal.vue'
import SwitchInput from '@/components/SwitchInput.vue'
import TextInput from '@/components/TextInput.vue'
import GenericButton from '@/components/GenericButton.vue'
import { useMetadataStore } from '@/stores/metadata.js'

const emits = defineEmits(['close', 'select'])
const props = defineProps({
  openModal: {
    required: true,
    type: Boolean
  }
})

const isOpen = ref(props.openModal)

const metadataStore = useMetadataStore()
const isRemoteConnection = ref(false)
const host = ref('https://db.minderal.com')
const databaseName = ref('')
const username = ref('')
const password = ref('')

async function addConnection () {
  if (isRemoteConnection.value) {
    await metadataStore.addConnection(databaseName.value, host.value, username.value, password.value)
  } else {
    await metadataStore.addConnection(databaseName.value)
  }
  isOpen.value = false
}

watch(() => props.openModal, (value) => {
  if (value) isOpen.value = true
})

watch(isOpen, () => {
  emits('close')
})

</script>
