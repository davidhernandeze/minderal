<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
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

// Users section
const users = ref<{ name: string; roles: string[] }[]>([])
const usersLoading = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const userError = ref('')

watch(
  () => props.visible,
  async (val) => {
    if (!val) return
    dbError.value = ''
    userError.value = ''

    if (props.database) {
      dbName.value = props.database.name
      if (isRemote.value) {
        await loadUsers()
      }
    } else {
      dbName.value = ''
      users.value = []
    }
  }
)

async function loadUsers() {
  if (!props.connection || !props.database) return
  usersLoading.value = true
  const security = await props.connection.getDbSecurity(props.database.name)
  if (security?.members?.names) {
    users.value = security.members.names.map((name) => ({ name, roles: [] }))
  } else {
    users.value = []
  }
  usersLoading.value = false
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

async function addUser() {
  if (!props.connection || !props.database || !newUsername.value.trim()) return
  userError.value = ''

  // First ensure user exists in _users db
  if (newPassword.value.trim()) {
    const created = await props.connection.createUser(
      newUsername.value.trim(),
      newPassword.value.trim()
    )
    if (!created) {
      userError.value = 'Failed to create user. It may already exist.'
    }
  }

  // Add user to this database's security
  const ok = await props.connection.addUserToDb(props.database.name, newUsername.value.trim())
  if (!ok) {
    userError.value = 'Failed to add user to database.'
    return
  }

  newUsername.value = ''
  newPassword.value = ''
  await loadUsers()
}

async function removeUser(username: string) {
  if (!props.connection || !props.database) return
  await props.connection.removeUserFromDb(props.database.name, username)
  await loadUsers()
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

      <!-- Users Section (remote only, existing databases) -->
      <section v-if="isRemote && !isNew">
        <h3 class="text-sm font-semibold mb-3">Users</h3>

        <!-- User list -->
        <div v-if="usersLoading" class="text-sm opacity-60">Loading users...</div>
        <ul v-else class="flex flex-col gap-1 mb-3">
          <li
            v-for="user in users"
            :key="user.name"
            class="flex items-center justify-between py-1 px-2 rounded hover:bg-surface-100 dark:hover:bg-surface-700"
          >
            <span class="flex items-center gap-2">
              <i class="bi bi-person" />
              {{ user.name }}
            </span>
            <Button
              severity="danger"
              text
              size="small"
              icon="bi bi-trash"
              @click="removeUser(user.name)"
            />
          </li>
          <li v-if="users.length === 0" class="text-sm opacity-60">
            No users assigned to this database.
          </li>
        </ul>

        <!-- Add user form -->
        <div class="flex flex-col gap-2 pt-2 border-t border-surface-200 dark:border-surface-700">
          <TextInput v-model="newUsername" label="Username" />
          <TextInput
            v-model="newPassword"
            label="Password (for new users)"
            type="password"
          />
          <p v-if="userError" class="text-red-500 text-sm">{{ userError }}</p>
          <div class="flex justify-end">
            <Button size="small" @click="addUser">Add User</Button>
          </div>
        </div>
      </section>
    </div>
  </Dialog>
</template>
