import type { Database } from './Database.js'

export abstract class Connection {
  protected constructor() {}

  abstract getDatabaseList(): Promise<string[]>

  abstract getDatabase(name: string): Database
}
