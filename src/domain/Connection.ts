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
  }

  public addDatabase(name: string) {
    console.log('adding db', name)
    if (this.dbs.has(name)) return
    const database = new Database(name, this)
    this.dbs.set(name, database)
    console.log('db added', this.dbs)

    database.on('change', () => {
      this.emit('change', this)
    })
  }

  getConfig(): ConnectionConfig {
    console.log('dbs in conn', this.dbs)
    return { ...this.config, dbs: Array.from(this.dbs.values()).map((db) => db.getConfig()) }
  }

  getDatabaseList(): Database[] {
    return Array.from(this.dbs.values())
  }

  getDatabase(name: string): Database | null {
    return this.dbs.get(name) || null
  }
}
