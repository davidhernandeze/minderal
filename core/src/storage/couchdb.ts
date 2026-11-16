import type { Credentials } from './DatabaseLocation.js'

export function openCouchDb(pouchdb: PouchDB.Static, url: string, credentials: Credentials | undefined): PouchDB.Database {
  const options: PouchDB.HttpAdapter.HttpAdapterConfiguration = { adapter: 'http' }
  if (credentials !== undefined) options.auth = { username: credentials.username, password: credentials.password }
  return new pouchdb(url, options)
}

/** Another node's dataset endpoint, opened for replication: it exists already, so no setup request. */
export function openEndpoint(pouchdb: PouchDB.Static, url: string, nodeId?: string): PouchDB.Database {
  const options: PouchDB.HttpAdapter.HttpAdapterConfiguration & { headers?: Record<string, string> } = { adapter: 'http', skip_setup: true }
  // an orchestrator without data relays this node's requests to another holder, never back to itself
  if (nodeId !== undefined) options.headers = { 'x-minderal-node': nodeId }
  return new pouchdb(url, options)
}
