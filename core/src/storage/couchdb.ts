import type { Credentials } from './DatabaseLocation.js'

export function openCouchDb(pouchdb: PouchDB.Static, url: string, credentials: Credentials | undefined): PouchDB.Database {
  const options: PouchDB.HttpAdapter.HttpAdapterConfiguration = { adapter: 'http' }
  if (credentials !== undefined) options.auth = { username: credentials.username, password: credentials.password }
  return new pouchdb(url, options)
}
