import { Database } from '@/domain/Database'
import { ConnectionConfig } from '@/domain/types/config'
import { v4 as generateId } from 'uuid'

export class Connection {
  id: string = ''
  databases: Database[] = []

  constructor(public options: ConnectionConfig) {
    this.id = options.id || generateId()
  }

  public addDatabase(name: string) {
    const database = new Database(name, this)
    this.databases.push(database)
  }
}
