import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../../src/index.js'
import type { Database, NeuronChange } from '../../src/index.js'

// The piece that cannot be trusted from the local adapter: a live changes feed
// over HTTP, authenticated by the AuthSession cookie our custom fetch replays.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const databaseName = 'watch-integration'

async function adminRequest(path: string, method: string): Promise<Response> {
  return fetch(`${couchUrl}${path}`, { method, headers: { Authorization: basicAuth } })
}

async function connect(): Promise<Database> {
  const connection = await ConnectionFactory.createRemoteConnection({
    url: couchUrl,
    username,
    password
  })
  return connection.getDatabase(databaseName)
}

function collect(database: Database) {
  const changes: NeuronChange[] = []
  const errors: Error[] = []
  const stopping = database.watch({
    change: (change) => changes.push(change),
    error: (error) => errors.push(error)
  })
  return {
    changes,
    errors,
    async waitFor(count: number, timeoutMs = 10000): Promise<void> {
      const deadline = Date.now() + timeoutMs
      while (changes.length < count) {
        if (Date.now() > deadline) {
          throw new Error(`only ${changes.length} of ${count}; errors: ${errors.join('; ')}`)
        }
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    },
    async stop(): Promise<void> {
      ;(await stopping)()
    }
  }
}

beforeAll(async () => {
  const reachable = await fetch(`${couchUrl}/_up`).catch(() => null)
  if (reachable === null || !reachable.ok) {
    throw new Error(`CouchDB is not reachable at ${couchUrl}. Run: npm run couchdb:up`)
  }
  await adminRequest(`/${databaseName}`, 'PUT')
})

afterAll(async () => {
  await adminRequest(`/${databaseName}`, 'DELETE')
})

describe('Watching a real CouchDB over HTTP', () => {
  it('delivers a create through the authenticated feed', async () => {
    const database = await connect()
    const watcher = collect(database)

    const neuron = await database.create(StringNeuron.create({ value: 'over http', parentId: 'p' }))
    await watcher.waitFor(1)

    expect(watcher.errors).toEqual([])
    expect(watcher.changes[0]).toMatchObject({ id: neuron.id, parentId: 'p', deletedAt: null })
    await watcher.stop()
    await database.close()
  })

  it('delivers a soft delete as a change carrying deletedAt', async () => {
    const database = await connect()
    const neuron = await database.create(StringNeuron.create({ value: 'to delete' }))
    const watcher = collect(database)

    await database.delete(neuron)
    await watcher.waitFor(1)

    expect(watcher.changes.at(-1)?.deletedAt).not.toBeNull()
    await watcher.stop()
    await database.close()
  })

  it('sees a write made by another client', async () => {
    // Nothing local triggered this one, which is the whole point of the feed.
    const database = await connect()
    const other = await connect()
    const watcher = collect(database)

    const neuron = await other.create(StringNeuron.create({ value: 'from elsewhere' }))
    await watcher.waitFor(1)

    expect(watcher.changes.some((change) => change.id === neuron.id)).toBe(true)
    await watcher.stop()
    await database.close()
    await other.close()
  })
})
