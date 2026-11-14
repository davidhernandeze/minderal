import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../../src/index.js'
import type { Database, Replication } from '../../src/index.js'

PouchDB.plugin(memoryAdapter)

// The local-first path for real: an in-memory local database syncing with
// CouchDB over HTTP, through the same authenticated fetch.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const databaseName = 'replication-integration'
const localConnection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const started: Replication[] = []

async function adminRequest(path: string, method: string): Promise<Response> {
  return fetch(`${couchUrl}${path}`, { method, headers: { Authorization: basicAuth } })
}

async function connectRemote(): Promise<Database> {
  const connection = await ConnectionFactory.createRemoteConnection({
    url: couchUrl,
    username,
    password
  })
  return connection.getDatabase(databaseName)
}

async function waitUntil(condition: () => Promise<boolean> | boolean, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await condition()) return
    if (Date.now() > deadline) throw new Error('timed out waiting for replication')
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

beforeAll(async () => {
  const reachable = await fetch(`${couchUrl}/_up`).catch(() => null)
  if (reachable === null || !reachable.ok) {
    throw new Error(`CouchDB is not reachable at ${couchUrl}. Run: npm run couchdb:up`)
  }
  await adminRequest(`/${databaseName}`, 'PUT')
})

afterEach(async () => {
  for (const replication of started) replication.stop()
  started.length = 0
  await localConnection.close()
  await new PouchDB(databaseName, { adapter: 'memory' }).destroy()
})

afterAll(async () => {
  await adminRequest(`/${databaseName}`, 'DELETE')
})

describe('Local database syncing with a real CouchDB', () => {
  it('pushes a local neuron to the server and pulls one back', async () => {
    const local = localConnection.getDatabase(databaseName)
    const remote = await connectRemote()
    const fromServer = await remote.create(StringNeuron.create({ value: 'made on the server' }))

    const replication = await local.syncWith(remote)
    started.push(replication)
    await waitUntil(() => replication.isCaughtUp)

    // The server's document arrived locally.
    expect(await local.get(fromServer.id)).not.toBeNull()

    // And a local write goes the other way.
    const fromLocal = await local.create(StringNeuron.create({ value: 'made locally' }))
    await waitUntil(async () => (await remote.get(fromLocal.id)) !== null)

    await remote.close()
  })

  it('reaches a local watcher when the server is what changed', async () => {
    // The reason the UI watches the local feed only: a remote write arrives
    // through replication and surfaces on the same subscription as a local one.
    const local = localConnection.getDatabase(databaseName)
    const remote = await connectRemote()
    const replication = await local.syncWith(remote)
    started.push(replication)
    await waitUntil(() => replication.isCaughtUp)

    const seen: string[] = []
    const stop = await local.watch({ change: (change) => seen.push(change.id) })

    const onServer = await remote.create(StringNeuron.create({ value: 'server side write' }))
    await waitUntil(() => seen.includes(onServer.id))

    stop()
    await remote.close()
  })
})
