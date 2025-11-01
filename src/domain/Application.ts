import { Connection } from './Connection'
import { Tab } from './Tab'
import { Database } from '@/domain/Database'
import LocalConnection from '@/domain/LocalConnection'
import { EventEmitter } from 'events'
import { ConfigDoc } from '@/domain/types/config'

export class Application extends EventEmitter {
  private configDatabase: Database
  private configDocument: ConfigDoc

  constructor(
    public connections: Map<string, Connection> = new Map(),
    public tabs: Map<string, Tab> = new Map()
  ) {
    super()
    this.connections.set('local', LocalConnection.getInstance())
  }

  async initialize() {
    await this.setInitialStateFromConfig()
  }

  async setInitialStateFromConfig() {
    this.configDatabase = new Database('_config', LocalConnection.getInstance())
    this.configDocument = await this.configDatabase.getOrCreateConfigDoc()

    const firstTimeUsage = localStorage.getItem('first_setup') !== 'true'
    console.log(firstTimeUsage)
    if (firstTimeUsage) {
      await this.addLocalConnection()
      localStorage.setItem('first_setup', 'true')
    }
    console.log(this.configDocument)
    this.setConnectionsFromConfig()
  }

  async addLocalConnection() {
    const localConnection = LocalConnection.getInstance()
    localConnection.addDatabase('local')
    this.connections.set('local', localConnection)
    this.configDocument.connections.push(localConnection.getConfig())
    this.configDocument._rev = await this.configDatabase.updateDoc(this.configDocument)
  }

  setConnectionsFromConfig() {
    for (const connectionConfid of this.configDocument.connections) {
      const connection = this.connections.has(connectionConfid.id)
        ? this.connections.get(connectionConfid.id)
        : new Connection(connectionConfid)

      if (!this.connections.has(connection.id)) {
        this.connections.set(connection.id, connection)
      }

      for (const databaseConfig of connectionConfid.dbs || []) {
        connection.addDatabase(databaseConfig.name)
      }
    }
    this.emit('connections:changed', Array.from(this.connections.values()))
  }

  async openNewTab(connection: Connection): Promise<void> {
    this.tabs.forEach((tab: Tab) => {
      tab.isOpen = false
    })
    const newTab: Tab = new Tab(connection, '')
    this.tabs.set(newTab.id, newTab)
    this.configDocument.tabs.push(newTab.getConfig())
    this.configDocument._rev = await this.configDatabase.updateDoc(this.configDocument)
  }
}
