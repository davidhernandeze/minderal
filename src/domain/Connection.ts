import { Database } from '@/domain/Database'
import { ConnectionConfig } from '@/domain/types/config'
import { v4 as generateId } from 'uuid'

export class Connection {
  id: string = ''
  name: string = ''
  dbs: Map<string, Database> = new Map()

  constructor(public config: ConnectionConfig) {
    this.id = config.id || generateId()
  }

  public addDatabase(name: string) {
    if (this.dbs.has(name)) return
    const database = new Database(name, this)
    console.log(database)
    this.dbs.set(name, database)
    this.config.dbs.push(database.getConfig())
  }

  getConfig(): ConnectionConfig {
    return this.config
  }

  getDatabaseList(): Database[] {
    return Array.from(this.dbs.values())
  }
}
