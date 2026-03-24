<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import TextInput from '@/components/TextInput.vue'
import { Connection } from '@/domain/Connection'
import { Database } from '@/domain/Database'

const props = defineProps<{
  visible: boolean
  connection: Connection | null
  database: Database | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'database-created': [dbName: string]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

const isNew = computed(() => !props.database)
const isRemote = computed(() => props.connection?.is_remote ?? false)

// Database info
const dbName = ref('')
const dbError = ref('')
const dbLoading = ref(false)

// Users access section
const allUsers = ref<string[]>([])
const grantedUsers = ref<string[]>([])
const usersLoading = ref(false)

watch(
  () => props.visible,
  async (val) => {
    if (!val) return
    dbError.value = ''

    if (props.database) {
      dbName.value = props.database.name
      if (isRemote.value) {
        await loadUsersAccess()
      }
    } else {
      dbName.value = ''
      allUsers.value = []
      grantedUsers.value = []
    }
  }
)

async function loadUsersAccess() {
  if (!props.connection || !props.database) return
  usersLoading.value = true

  // Load all connection users
  const users = await props.connection.getUsers()
  allUsers.value = users.map((u) => u.name)

  // Load which users have access to this database
  const security = await props.connection.getDbSecurity(props.database.name)
  grantedUsers.value = security?.members?.names || []

  usersLoading.value = false
}

async function toggleUserAccess(username: string, checked: boolean) {
  if (!props.connection || !props.database) return

  if (checked) {
    await props.connection.addUserToDb(props.database.name, username)
  } else {
    await props.connection.removeUserFromDb(props.database.name, username)
  }

  // Update local state
  const security = await props.connection.getDbSecurity(props.database.name)
  grantedUsers.value = security?.members?.names || []
}

async function createDatabase() {
  if (!props.connection || !dbName.value.trim()) return
  dbError.value = ''
  dbLoading.value = true

  const name = dbName.value.trim()

  if (props.connection.is_remote) {
    const ok = await props.connection.createRemoteDatabase(name)
    if (!ok) {
      dbError.value = 'Failed to create database.'
      dbLoading.value = false
      return
    }
  } else {
    props.connection.addDatabase(name)
  }

  // Seed the root widget document
  const db = props.connection.getDatabase(name)
  if (db) {
    await db.createWidgetDoc({
      _id: 'widget:root',
      name: 'Home',
      widget: 'folder',
      content: '',
      parent_id: '',
      settings: { icon: 'bi bi-house' },
      created_by: 'root',
      deleted_at: null
    })
  }

  dbLoading.value = false
  emit('database-created', name)
  emit('update:visible', false)
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    :header="isNew ? 'New Database' : `Manage: ${database?.name}`"
    modal
    class="w-full md:w-[650px]"
  >
    <div class="flex flex-col gap-6 text-xss">
      <!-- Database Info Section -->
      <section>
        <h3 class="text-sm font-semibold mb-3">Database Info</h3>
        <TextInput v-model="dbName" label="Name" :disabled="!isNew" />
        <p v-if="dbError" class="text-red-500 text-sm mt-2">{{ dbError }}</p>
        <div v-if="isNew" class="mt-3 flex justify-end">
          <Button :loading="dbLoading" @click="createDatabase">Create</Button>
        </div>
      </section>

      <!-- Users Access Section (remote only, existing databases) -->
      <section
        v-if="isRemote && !isNew"
        class="border-t border-surface-200 dark:border-surface-700 pt-4"
      >
        <h3 class="text-sm font-semibold mb-3">User Access</h3>

        <div v-if="usersLoading" class="text-sm opacity-60">Loading users...</div>
        <ul v-else class="flex flex-col gap-2">
          <li
            v-for="username in allUsers"
            :key="username"
            class="flex items-center gap-3 py-1 px-2 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <Checkbox
              :model-value="grantedUsers.includes(username)"
              :binary="true"
              :input-id="`user-access-${username}`"
              @update:model-value="(val: boolean) => toggleUserAccess(username, val)"
            />
            <label :for="`user-access-${username}`" class="flex items-center gap-2 cursor-pointer">
              <i class="bi bi-person" />
              {{ username }}
            </label>
          </li>
          <li v-if="allUsers.length === 0" class="text-sm opacity-60">
            No users on this connection. Add users in the connection settings.
          </li>
        </ul>
      </section>
    </div>
  </Dialog>
</template>
