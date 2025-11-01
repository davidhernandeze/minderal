import { Connection } from './Connection'
import { Tab } from './Tab'
import { Database } from '@/domain/Database'
import LocalConnection from '@/domain/LocalConnection'
import { ConfigDoc } from '@/domain/ConfigDoc'
import { EventEmitter } from 'events'

export class Application extends EventEmitter {
  private configDatabase: Database
  private configDocument: ConfigDoc

  constructor(
    public connections: Map<string, Connection> = new Map(),
    public tabs: Map<string, Tab> = new Map(),
    public dbs: Map<string, Database> = new Map()
  ) {
    super()
    this.connections.set('local', LocalConnection.getInstance())
  }

  async initialize() {
    await this.setStateFromConfig()
  }

  async setStateFromConfig() {
    this.configDatabase = new Database('_config', LocalConnection.getInstance())
    this.configDocument = await this.configDatabase.getOrCreateConfigDoc()
    console.log(this.configDocument)
    this.setDatabasesFromConfig()

    const firstTimeUsage = localStorage.getItem('initialized') !== 'true'

    if (firstTimeUsage) {
      await this.addDatabase('local', LocalConnection.getInstance())
      localStorage.setItem('initialized', 'true')
    }
  }

  setDatabasesFromConfig() {
    for (const db of this.configDocument.dbs) {
      const connection = this.connections.get(db.connection_id)
      if (!connection) continue
      this.dbs.set(db.id, new Database(db.name, connection))
    }

    this.emit('dbs:changed', this.dbs.values)
  }

  async addDatabase(name: string, connection: Connection): Promise<void> {
    const newDatabase = new Database(name, connection)
    await newDatabase.indexBy('parent_id')
    await newDatabase.indexBy('deleted_at')
    await newDatabase.indexBy('widget')

    this.dbs.set(newDatabase.id, newDatabase)
    this.configDocument.dbs.push(newDatabase.getConfig())

    this.configDocument._rev = await this.configDatabase.updateDoc(this.configDocument)
    await this.openNewTab(LocalConnection.getInstance())
    this.emit('dbs:changed', this.dbs)
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
