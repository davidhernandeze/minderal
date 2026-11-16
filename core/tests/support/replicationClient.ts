import HttpAdapter from 'pouchdb-adapter-http'
import MemoryAdapter from 'pouchdb-adapter-memory'
import PouchDB from 'pouchdb-core'
import Replication from 'pouchdb-replication'

const ClientPouchDB = PouchDB.plugin(MemoryAdapter).plugin(HttpAdapter).plugin(Replication)

export interface RemoteCredentials {
  readonly username: string
  readonly password: string
}

export function memoryDatabase(): PouchDB.Database {
  return new ClientPouchDB(`client-${crypto.randomUUID()}`, { adapter: 'memory' })
}

export function remoteDatabase(url: string, credentials?: RemoteCredentials): PouchDB.Database {
  const options: PouchDB.HttpAdapter.HttpAdapterConfiguration = { adapter: 'http', skip_setup: true }
  if (credentials !== undefined) options.auth = { username: credentials.username, password: credentials.password }
  return new ClientPouchDB(url, options)
}
