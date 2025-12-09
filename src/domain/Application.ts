import { Connection } from './Connection'
import { Tab } from './Tab'
import { Database } from '@/domain/Database'
import LocalConnection from '@/domain/LocalConnection'
import { EventEmitter } from 'events'
import { ConfigDocStructure } from '@/domain/types/config'

export class Application extends EventEmitter {
  private connections: Map<string, Connection> = new Map()
  private tabs: Map<string, Tab> = new Map()
  activeTabId: string | null = null

  private configDatabase: Database
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

    this.setConnectionsFromConfig()
    this.setTabsFromConfig()
    const firstTimeUsage = localStorage.getItem('first_setup') !== 'true'

    if (firstTimeUsage) {
      await this.addLocalConnection()
      const database: Database = LocalConnection.getInstance().getDatabaseList()[0]
      await this.openNewTab(database)
      const tab: Tab = this.tabs.get(this.activeTabId)
      const widget = await tab.workspace.widgetFactory.createFromRequest({
        parent_id: 'root',
        name: 'my first text widget',
        content: 'important text',
        widget: 'text'
      })
      await widget.save()
      localStorage.setItem('first_setup', 'true')
    }

    await this.updateConfigDocument()
    void this.configDatabase.startListening()
    this.configDatabase.on(`doc:changed:config`, async (doc) => {
      if (doc?._rev !== this.configDocument._rev) {
        this.configDocument = doc
        this.setConnectionsFromConfig()
        this.setTabsFromConfig()
      }
    })
  }

  async addLocalConnection() {
    const localConnection = LocalConnection.getInstance()
    localConnection.addDatabase('local')
    this.connections.set('local', localConnection)
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

  setTabsFromConfig() {
    for (const tabConfig of this.configDocument.tabs) {
      const connection = this.connections.get(tabConfig.connection_id)
      const database = connection?.getDatabase(tabConfig.database_name)
      if (!database) {
        this.tabs.delete(tabConfig.id)
        continue
      }
      const tab = new Tab(database, tabConfig)
      this.tabs.set(tab.id, tab)
    }
    const activeTab = this.tabs.get(this.configDocument.active_tab_id)
    this.activeTabId = activeTab?.id ?? null
    this.emit('tabs:changed')
  }

  async openNewTab(database: Database): Promise<void> {
    const newTab: Tab = new Tab(database, {})
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

  async updateConfigDocument() {
    const newConfig = { ...this.configDocument }
    newConfig.connections = this.getConnections().map((conn) => conn.getConfig())
    newConfig.tabs = this.getTabs().map((tab) => tab.getConfig())
    newConfig.active_tab_id = this.activeTabId
    this.configDocument = newConfig
    this.configDocument._rev = await this.configDatabase.updateDoc(this.configDocument)
  }

  getTabs() {
    return Array.from(this.tabs.values())
  }

  getConnections() {
    return Array.from(this.connections.values())
  }
}
