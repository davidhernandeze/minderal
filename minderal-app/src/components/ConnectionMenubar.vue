<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import Menubar from 'primevue/menubar'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import TextInput from '@/components/TextInput.vue'
import DatabaseManageModal from '@/components/DatabaseManageModal.vue'
import { Application } from '@/domain/Application'
import { Connection } from '@/domain/Connection'
import { Database } from '@/domain/Database'
import { useReactiveObjectProp } from '@/composables/useReactiveObjectProp'
import { v4 as generateId } from 'uuid'
import { MenuItem } from 'primevue/menuitem'

const app = inject<Application>('app')

const connections = useReactiveObjectProp<Application, Connection[]>(
  app,
  (a) => a.getConnections(),
  'connections:changed'
)

// Connection dialog state
const showDialog = ref(false)
const isEditing = ref(false)
const editingConnection = ref<Connection | null>(null)
const editingConnectionId = ref<string | null>(null)
const form = ref({ url: '', username: '', password: '' })
const error = ref('')
const loading = ref(false)

// Users CRUD state (connection-level)
const connectionUsers = ref<{ name: string }[]>([])
const usersLoading = ref(false)
const newUserName = ref('')
const newUserPassword = ref('')
const userError = ref('')

// Database manage modal state
const showDbModal = ref(false)
const dbModalConnection = ref<Connection | null>(null)
const dbModalDatabase = ref<Database | null>(null)

function openAddDialog() {
  isEditing.value = false
  editingConnectionId.value = null
  form.value = { url: 'http://localhost:5984', username: '', password: '' }
  error.value = ''
  showDialog.value = true
}

function openEditDialog(connection: Connection) {
  if (connection.id === 'local') return
  isEditing.value = true
  editingConnection.value = connection
  editingConnectionId.value = connection.id
  form.value = {
    url: connection.url,
    username: connection.config.auth?.username || '',
    password: ''
  }
  error.value = ''
  userError.value = ''
  showDialog.value = true
  void loadConnectionUsers(connection)
}

async function loadConnectionUsers(connection: Connection) {
  usersLoading.value = true
  connectionUsers.value = (await connection.getUsers()).map((u) => ({ name: u.name }))
  usersLoading.value = false
}

async function addConnectionUser() {
  if (!editingConnection.value || !newUserName.value.trim() || !newUserPassword.value.trim()) return
  userError.value = ''
  const ok = await editingConnection.value.createUser(
    newUserName.value.trim(),
    newUserPassword.value.trim()
  )
  if (!ok) {
    userError.value = 'Failed to create user.'
    return
  }
  newUserName.value = ''
  newUserPassword.value = ''
  await loadConnectionUsers(editingConnection.value)
}

async function deleteConnectionUser(username: string) {
  if (!editingConnection.value) return
  await editingConnection.value.deleteUser(username)
  await loadConnectionUsers(editingConnection.value)
}

async function submitForm() {
  error.value = ''
  loading.value = true

  const config = {
    id: editingConnectionId.value || `${generateId()}`,
    name: form.value.url.replace(/https?:\/\//, ''),
    url: form.value.url,
    auth: {
      username: form.value.username,
      password: form.value.password
    },
    is_remote: true,
    is_online: false,
    dbs: []
  }

  const newConnection = await Connection.createRemote(config)

  if (!newConnection) {
    error.value = 'Failed to connect. Please check your credentials and URL.'
    loading.value = false
    return
  }

  if (isEditing.value) {
    await app.updateConnection(newConnection)
  } else {
    await app.saveConnection(newConnection)
  }

  loading.value = false
  showDialog.value = false
}

async function deleteConnection() {
  if (editingConnectionId.value) {
    await app.deleteConnection(editingConnectionId.value)
  }
  showDialog.value = false
}

async function openDatabase(connection: Connection, dbName: string) {
  const db = connection.getDatabase(dbName)
  if (db) {
    await app.openNewTab(db)
  }
}

function openNewDbModal(connection: Connection) {
  dbModalConnection.value = connection
  dbModalDatabase.value = null
  showDbModal.value = true
}

function openManageDbModal(connection: Connection, db: Database) {
  dbModalConnection.value = connection
  dbModalDatabase.value = db
  showDbModal.value = true
}

function onDatabaseCreated() {
  app.updateConfigDocument()
}

const menuItems = computed(() => {
  const connectionItems = connections.value.map((connection) => {
    const isLocal = connection.id === 'local'

    const dbChildren: MenuItem[] = connection.getDatabaseList().map((db) => ({
      label: db.name,
      icon: 'bi bi-database',
      _db: db,
      _connection: connection,
      _isDbItem: true,
      command: () => openDatabase(connection, db.name)
    }))

    // Add "New Database" as last item
    dbChildren.push({
      label: 'New Database',
      icon: 'bi bi-plus-circle',
      command: () => openNewDbModal(connection)
    })

    return {
      label: connection.name,
      icon: isLocal ? 'bi bi-hdd' : 'bi bi-cloud',
      items: dbChildren,
      _connection: connection,
      _isLocal: isLocal
    }
  })

  connectionItems.push({
    label: 'Add Connection',
    icon: 'bi bi-plus-circle',
    command: openAddDialog
  } as any)

  return [
    {
      label: 'Connections',
      icon: 'bi bi-diagram-3',
      items: connectionItems
    }
  ]
})
</script>

<template>
  <div class="text-xss">
    <Menubar class="!p-0" :model="menuItems">
      <template #item="{ item, props, hasSubmenu, root }">
        <a class="flex items-center" v-bind="props.action">
          <span :class="item.icon" class="mr-2" />
          <span>{{ item.label }}</span>
          <!-- Online indicator for remote connections -->
          <span
            v-if="item._connection && !item._isLocal && !item._isDbItem"
            class="ml-2 inline-block w-2.5 h-2.5 rounded-full cursor-pointer"
            :class="item._connection.is_online ? 'bg-green-500' : 'bg-gray-400'"
            @click.stop.prevent="openEditDialog(item._connection)"
          />
          <!-- Manage button for database items -->
          <i
            v-if="item._isDbItem"
            class="bi bi-gear ml-auto opacity-50 hover:opacity-100 cursor-pointer"
            @click.stop.prevent="openManageDbModal(item._connection, item._db)"
          />
          <i
            v-if="hasSubmenu"
            :class="['bi ml-auto text-xs', root ? 'bi-chevron-down' : 'bi-chevron-right']"
          />
        </a>
      </template>
    </Menubar>

    <!-- Connection Add/Edit Dialog -->
    <Dialog
      v-model:visible="showDialog"
      :header="isEditing ? 'Edit Connection' : 'Add Connection'"
      modal
      class="w-full md:w-[500px]"
    >
      <div class="flex flex-col gap-6 text-xss">
        <!-- Connection form -->
        <form class="flex flex-col gap-4" @submit.prevent="submitForm">
          <TextInput
            v-model="form.url"
            :disabled="isEditing"
            label="URL"
            placeholder="http://localhost:5984"
          />
          <TextInput v-model="form.username" :disabled="isEditing" label="User" />
          <TextInput v-if="!isEditing" v-model="form.password" label="Password" type="password" />

          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>

          <div class="flex gap-2 justify-end">
            <Button
              v-if="isEditing"
              severity="danger"
              type="button"
              :disabled="loading"
              @click="deleteConnection"
            >
              Delete
            </Button>
            <Button type="submit" :loading="loading">
              {{ isEditing ? 'Update' : 'Connect' }}
            </Button>
          </div>
        </form>

        <!-- Users CRUD (edit mode only) -->
        <section v-if="isEditing" class="border-t border-surface-200 dark:border-surface-700 pt-4">
          <h3 class="text-sm font-semibold mb-3">Users</h3>

          <div v-if="usersLoading" class="text-sm opacity-60">Loading users...</div>
          <ul v-else class="flex flex-col gap-1 mb-3">
            <li
              v-for="user in connectionUsers"
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
                @click="deleteConnectionUser(user.name)"
              />
            </li>
            <li v-if="connectionUsers.length === 0" class="text-sm opacity-60">
              No users on this server.
            </li>
          </ul>

          <div class="flex flex-col gap-2 pt-2 border-t border-surface-200 dark:border-surface-700">
            <TextInput v-model="newUserName" label="Username" />
            <TextInput v-model="newUserPassword" label="Password" type="password" />
            <p v-if="userError" class="text-red-500 text-sm">{{ userError }}</p>
            <div class="flex justify-end">
              <Button size="small" @click="addConnectionUser">Add User</Button>
            </div>
          </div>
        </section>
      </div>
    </Dialog>

    <!-- Database Manage Modal -->
    <DatabaseManageModal
      v-model:visible="showDbModal"
      :connection="dbModalConnection"
      :database="dbModalDatabase"
      @database-created="onDatabaseCreated"
    />
  </div>
</template>
<style>
.p-menubar-mobile .p-menubar-root-list {
  width: auto !important;
}
</style>
