import { Database } from '@/domain/Database'
import { ConnectionConfig } from '@/domain/types/config'
import { v4 as generateId } from 'uuid'
import { EventEmitter } from 'events'

export class Connection extends EventEmitter {
  id: string = ''
  name: string = ''
  dbs: Map<string, Database> = new Map()
  config: ConnectionConfig

  constructor(config: ConnectionConfig) {
    super()
    this.id = config.id || generateId()
    this.name = config.name
    this.config = config

    for (const databaseConfig of config.dbs || []) {
      this.addDatabase(databaseConfig.name)
    }
  }

  public addDatabase(name: string) {
    if (this.dbs.has(name)) return

    const database = new Database(name, this)
    void database.startListening()
    this.dbs.set(name, database)

    database.on('change', () => {
      this.emit('change', this)
    })
  }

  getConfig(): ConnectionConfig {
    return { ...this.config, dbs: Array.from(this.dbs.values()).map((db) => db.getConfig()) }
  }

  getDatabaseList(): Database[] {
    return Array.from(this.dbs.values())
  }

  getDatabase(name: string): Database | null {
    return this.dbs.get(name) || null
  }
}
