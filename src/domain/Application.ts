import { Connection } from './Connection'
import { Tab } from './Tab'
import { Database } from '@/domain/Database'
import LocalConnection from '@/domain/LocalConnection'
import { EventEmitter } from 'events'
import { ConfigDocStructure } from '@/domain/types/config'

export class Application extends EventEmitter {
  private connections: Map<string, Connection> = new Map()
  private tabs: Map<string, Tab> = new Map()

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
    this.configDatabase = new Database('_config', LocalConnection.getInstance())
    this.configDocument = await this.configDatabase.getOrCreateConfigDoc()
    console.log(this.configDocument)

    this.setConnectionsFromConfig()
    this.setTabsFromConfig()
    const firstTimeUsage = localStorage.getItem('first_setup') !== 'true'

    if (firstTimeUsage) {
      await this.addLocalConnection()
      await this.openNewTab(LocalConnection.getInstance().getDatabaseList()[0])
      localStorage.setItem('first_setup', 'true')
    }

    await this.updateConfigDocument()
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
        this.emit('connections:changed', Array.from(this.connections.values()))
      })
    }
    this.emit('connections:changed', Array.from(this.connections.values()))
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
    this.emit('tabs:changed', Array.from(this.tabs.values()))
  }

  async openNewTab(database: Database): Promise<void> {
    const newTab: Tab = new Tab(database, {})
    this.tabs.set(newTab.id, newTab)
    await this.openTab(newTab)
  }

  async openTab(tabToOpen: Tab) {
    for (const tab of this.tabs.values()) {
      tab.isOpen = tabToOpen.id === tab.id
    }
    await this.updateConfigDocument()
    this.emit('tabs:changed', this.getTabs())
  }

  async closeTab(tabId: string) {
    this.tabs.delete(tabId)
    if (this.tabs.size > 0) {
      const lastTab = this.getTabs().pop()
      await this.openTab(lastTab)
    }
    await this.updateConfigDocument()
    this.emit('tabs:changed', this.getTabs())
  }

  async updateConfigDocument() {
    const newConfig = { ...this.configDocument }
    newConfig.connections = this.getConnections().map((conn) => conn.getConfig())
    newConfig.tabs = this.getTabs().map((tab) => tab.getConfig())
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
