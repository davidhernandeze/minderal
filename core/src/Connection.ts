import type { Database } from './Database.js'

export abstract class Connection {
  private readonly databasesByName: Map<string, Database>

  protected constructor() {
    this.databasesByName = new Map()
  }

  abstract getDatabaseList(): Promise<string[]>

  getDatabase(name: string): Database {
    const existingDatabase = this.databasesByName.get(name)
    if (existingDatabase !== undefined) return existingDatabase

    const database = this.createDatabase(name)
    this.databasesByName.set(name, database)
    return database
  }

  async close(): Promise<void> {
    for (const database of this.databasesByName.values()) {
      await database.close()
    }
    this.databasesByName.clear()
  }

  protected abstract createDatabase(name: string): Database
}
