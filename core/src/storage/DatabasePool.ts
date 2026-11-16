import { locationKey, type DatabaseLocation } from './DatabaseLocation.js'

export interface Closable {
  close(): Promise<void>
}

interface PoolEntry<Database> {
  readonly database: Database
  references: number
}

export class DatabasePool<Database extends Closable = PouchDB.Database> {
  private readonly open: (location: DatabaseLocation) => Database
  private readonly entries: Map<string, PoolEntry<Database>>
  private readonly closing: Map<string, Promise<void>>

  constructor(open: (location: DatabaseLocation) => Database) {
    this.open = open
    this.entries = new Map()
    this.closing = new Map()
  }

  async acquire(location: DatabaseLocation): Promise<DatabaseHandle<Database>> {
    const key = locationKey(location)
    await this.closing.get(key)
    let entry = this.entries.get(key)
    if (entry === undefined) {
      entry = { database: this.open(location), references: 0 }
      this.entries.set(key, entry)
    }
    entry.references += 1
    return new DatabaseHandle(entry.database, async () => this.release(key))
  }

  private async release(key: string): Promise<void> {
    const entry = this.entries.get(key)
    if (entry === undefined) return
    entry.references -= 1
    if (entry.references > 0) return
    this.entries.delete(key)
    const closed = entry.database.close()
    this.closing.set(key, closed)
    try {
      await closed
    } finally {
      this.closing.delete(key)
    }
  }
}

export class DatabaseHandle<Database extends Closable = PouchDB.Database> {
  readonly database: Database
  private releaseOnce: (() => Promise<void>) | undefined

  constructor(database: Database, release: () => Promise<void>) {
    this.database = database
    this.releaseOnce = release
  }

  async release(): Promise<void> {
    const release = this.releaseOnce
    this.releaseOnce = undefined
    if (release !== undefined) await release()
  }
}
