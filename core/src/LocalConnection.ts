import PouchDB from 'pouchdb'
import registerAllDbs, { type AllDbsCapability } from 'pouchdb-all-dbs'
import { Connection } from './Connection.js'
import { Database } from './Database.js'

export interface LocalConnectionOptions {
  adapter?: string
}

type PouchConstructorWithAllDbs = ReturnType<PouchDB.Static['defaults']> & AllDbsCapability

const pouchConstructorsByAdapter = new Map<string, PouchConstructorWithAllDbs>()

function getPouchConstructor(adapter: string | undefined): PouchConstructorWithAllDbs {
  const adapterKey = adapter ?? ''
  const existingConstructor = pouchConstructorsByAdapter.get(adapterKey)
  if (existingConstructor !== undefined) return existingConstructor

  const pouchConstructor = PouchDB.defaults(adapter === undefined ? {} : { adapter })
  registerAllDbs(pouchConstructor)
  pouchConstructorsByAdapter.set(adapterKey, pouchConstructor)
  return pouchConstructor
}

export const LOCAL_CONNECTION_USER = 'local'

export class LocalConnection extends Connection {
  private readonly pouchConstructor: PouchConstructorWithAllDbs
  private readonly adapter: string | undefined

  private constructor(options: LocalConnectionOptions) {
    super()
    this.adapter = options.adapter
    this.pouchConstructor = getPouchConstructor(options.adapter)
  }

  static create(options: LocalConnectionOptions): LocalConnection {
    return new LocalConnection(options)
  }

  async getDatabaseList(): Promise<string[]> {
    const names = await this.pouchConstructor.allDbs()
    return [...names].sort()
  }

  protected override createDatabase(name: string): Database {
    return Database.open(
      name,
      LOCAL_CONNECTION_USER,
      this.adapter === undefined ? {} : { adapter: this.adapter }
    )
  }
}
