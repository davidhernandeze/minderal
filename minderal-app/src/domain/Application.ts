import { Connection } from './Connection'
import { Tab } from './Tab'
import { Database } from '@/domain/Database'
import LocalConnection from '@/domain/LocalConnection'
import { EventEmitter } from 'events'
import { ConfigDocStructure, ConnectionConfig } from '@/domain/types/config'
import { v4 as generateId } from 'uuid'

export class Application extends EventEmitter {
  private connections: Map<string, Connection> = new Map()
  private tabs: Map<string, Tab> = new Map()
  activeTabId: string | null = null

  configDatabase: Database
  private configDocument: ConfigDocStructure

  constructor() {
    super()
  }

  async initialize() {
    await this.setInitialStateFromConfig()
    console.log(this)
  }

  async setInitialStateFromConfig() {
    this.configDatabase = new Database('config', LocalConnection.getInstance())
    this.configDocument = await this.configDatabase.getOrCreateConfigDoc()
    console.log(this.configDocument)

    await this.loadConnections()
    await this.setTabsFromConfig()
    await this.firstTimeSetup()

    await this.updateConfigDocument()
    void this.configDatabase.startListening()
    this.configDatabase.on(`doc:changed:config`, async (doc) => {
      if (doc?._rev !== this.configDocument._rev) {
        this.configDocument = doc
        await this.setTabsFromConfig()
      }
    })
  }

  private async firstTimeSetup() {
    const firstTimeUsage = localStorage.getItem('first_setup') !== 'true'

    if (firstTimeUsage) {
      await this.addLocalConnection()
      const database: Database = LocalConnection.getInstance().getDatabaseList()[0]
      await database.createWidgetDoc({
        _id: 'widget:root',
        name: 'Home',
        widget: 'folder',
        content: '',
        parent_id: '',
        settings: {
          icon: 'bi bi-house'
        },
        created_by: 'root',
        deleted_at: null
      })
      await this.openNewTab(database)
      localStorage.setItem('first_setup', 'true')
    }
  }

  async addLocalConnection() {
    const localConnection = LocalConnection.getInstance()
    localConnection.addDatabase('local')
    this.connections.set('local', localConnection)
  }

  async loadConnections() {
    // Always ensure local connection exists
    await this.addLocalConnection()

    // Load remote connections from config document
    for (const connectionConfig of this.configDocument.connections || []) {
      if (connectionConfig.id === 'local') continue
      const connection = await Connection.createRemote(connectionConfig)
      this.connections.set(connection.id, connection)

      connection.on('change', () => {
        this.emit('connections:changed')
      })
    }
    this.emit('connections:changed')
  }

  async saveConnection(connection: Connection): Promise<Connection> {
    this.connections.set(connection.id, connection)

    connection.on('change', () => {
      this.emit('connections:changed')
    })

    await this.updateConfigDocument()
    this.emit('connections:changed')
    return connection
  }

  async deleteConnection(connectionId: string) {
    if (connectionId === 'local') return
    this.connections.delete(connectionId)
    await this.updateConfigDocument()
    this.emit('connections:changed')
  }

  async updateConnection(connection: Connection): Promise<Connection> {
    const existing = this.connections.get(connection.id)
    if (existing) {
      // Close existing databases
      for (const db of existing.getDatabaseList()) {
        await db.closeClient()
      }
    }

    this.connections.set(connection.id, connection)

    connection.on('change', () => {
      this.emit('connections:changed')
    })

    await this.updateConfigDocument()
    this.emit('connections:changed')
    return connection
  }

  setConnectionsFromConfig() {
    for (const connectionConfid of this.configDocument.connections) {
      const connection = new Connection(connectionConfid)

      this.connections.set(connection.id, connection)

      connection.on('change', (connection) => {
        this.connections.set(connection.id, connection)
        this.emit('connections:changed')
      })
    }
    this.emit('connections:changed')
  }

  async setTabsFromConfig() {
    for (const tabConfig of this.configDocument.tabs) {
      const connection = this.connections.get(tabConfig.connection_id)
      const database = connection?.getDatabase(tabConfig.database_name)
      if (!database) {
        this.tabs.delete(tabConfig.id)
        continue
      }
      const tab = await Tab.createFromConfig(this, database, tabConfig)
      this.tabs.set(tab.id, tab)
    }
    const activeTab = this.tabs.get(this.configDocument.active_tab_id)
    this.activeTabId = activeTab?.id ?? null
    this.emit('tabs:changed')
  }

  async openNewTab(database: Database, docId = 'widget:root'): Promise<void> {
    const newTab: Tab = await Tab.createFromConfig(this, database, { doc_id: docId })
    this.tabs.set(newTab.id, newTab)
    await this.openTab(newTab)
  }

  async openTab(tabToOpen: Tab) {
    this.activeTabId = tabToOpen.id
    await this.updateConfigDocument()
    this.emit('tabs:changed')
  }

  async closeTab(tabToClose: Tab) {
    this.tabs.delete(tabToClose.id)
    if (this.tabs.size > 0) {
      const lastTab = this.getTabs().pop()
      await this.openTab(lastTab)
    }
    await this.updateConfigDocument()
    this.emit('tabs:changed')
  }

  async closeAllTabs() {
    this.tabs.clear()
    this.activeTabId = null
    await this.updateConfigDocument()
  }

  async updateConfigDocument() {
    const newConfig = { ...this.configDocument }
    newConfig.connections = this.getConnections().map((conn) => conn.getConfig())
    newConfig.tabs = this.getTabs().map((tab) => tab.getConfig())
    newConfig.active_tab_id = this.activeTabId
    this.configDocument = newConfig
    this.configDocument._rev = await this.configDatabase.updateDoc(this.configDocument)
    this.emit('tabs:changed')
  }

  getTabs() {
    return Array.from(this.tabs.values())
  }

  getConnections() {
    return Array.from(this.connections.values())
  }

  generateConnectionId(): string {
    return generateId()
  }
}
