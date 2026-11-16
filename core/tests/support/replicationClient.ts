import HttpAdapter from 'pouchdb-adapter-http'
import MemoryAdapter from 'pouchdb-adapter-memory'
import { withReplication } from '../../src/storage/replication.js'

const ClientPouchDB = withReplication().plugin(MemoryAdapter).plugin(HttpAdapter)

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
