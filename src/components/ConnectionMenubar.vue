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

const app = inject<Application>('app')

const connections = useReactiveObjectProp<Application, Connection[]>(
  app,
  (a) => a.getConnections(),
  'connections:changed'
)

// Connection dialog state
const showDialog = ref(false)
const isEditing = ref(false)
const editingConnectionId = ref<string | null>(null)
const form = ref({ url: '', username: '', password: '' })
const error = ref('')
const loading = ref(false)

// Database manage modal state
const showDbModal = ref(false)
const dbModalConnection = ref<Connection | null>(null)
const dbModalDatabase = ref<Database | null>(null)

function openAddDialog() {
  isEditing.value = false
  editingConnectionId.value = null
  form.value = { url: '', username: '', password: '' }
  error.value = ''
  showDialog.value = true
}

function openEditDialog(connection: Connection) {
  if (connection.id === 'local') return
  isEditing.value = true
  editingConnectionId.value = connection.id
  form.value = {
    url: connection.url,
    username: connection.config.auth?.username || '',
    password: ''
  }
  error.value = ''
  showDialog.value = true
}

async function submitForm() {
  error.value = ''
  loading.value = true

  const testConnection = new Connection({
    id: 'test',
    name: 'test',
    dbs: []
  })

  const result = await testConnection.testConnection(
    form.value.url,
    form.value.username,
    form.value.password
  )

  if (!result.ok) {
    error.value = 'Failed to connect. Please check your credentials and URL.'
    loading.value = false
    return
  }

  const connectionId = isEditing.value ? editingConnectionId.value : `connection:${generateId()}`

  const config = {
    id: connectionId,
    name: form.value.username,
    url: form.value.url,
    auth: {
      username: form.value.username,
      password: form.value.password
    },
    is_remote: true,
    is_online: false,
    session_cookie: result.cookie || '',
    dbs: []
  }

  let connection: Connection
  if (isEditing.value) {
    connection = await app.updateConnection(config)
  } else {
    connection = await app.saveConnection(config)
  }

  await connection.connect()

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

    const dbChildren: any[] = connection.getDatabaseList().map((db) => ({
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
      class="w-[400px]"
    >
      <form class="flex flex-col gap-4 text-xss" @submit.prevent="submitForm">
        <TextInput v-model="form.url" label="URL" placeholder="http://localhost:5984" />
        <TextInput v-model="form.username" label="User" />
        <TextInput v-model="form.password" label="Password" type="password" />

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
