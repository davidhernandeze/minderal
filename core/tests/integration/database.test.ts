import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../../src/index.js'
import type { StringNeuronDocument } from '../../src/index.js'

// Proves the remote write path end to end: PouchDB's http adapter, driven
// through the custom fetch that replays our AuthSession cookie. The unit tests
// only ever see a local adapter, so this is the one place that authentication
// for document writes is actually exercised.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const databaseName = 'neuron-integration'

async function adminRequest(path: string, method: string): Promise<Response> {
  return fetch(`${couchUrl}${path}`, { method, headers: { Authorization: basicAuth } })
}

async function readStoredDocument(id: string): Promise<StringNeuronDocument> {
  const response = await adminRequest(`/${databaseName}/${id}`, 'GET')
  return response.json()
}

beforeAll(async () => {
  try {
    const reachable = await fetch(`${couchUrl}/_up`)
    if (!reachable.ok) throw new Error(`responded ${reachable.status}`)
  } catch (cause) {
    throw new Error(
      `CouchDB is not reachable at ${couchUrl}. Run: npm run couchdb:up (${String(cause)})`
    )
  }
  await adminRequest(`/${databaseName}`, 'PUT')
})

afterAll(async () => {
  await adminRequest(`/${databaseName}`, 'DELETE')
})

describe('Database.create against a real CouchDB', () => {
  it('writes a neuron the server accepts and stores verbatim', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })
    const database = connection.getDatabase(databaseName)

    const neuron = await database.create(
      StringNeuron.create({ value: 'hello from integration', parentId: null })
    )

    expect(neuron.revision).toMatch(/^1-/)
    // createdBy comes from the verified session, not from the caller.
    expect(neuron.createdBy).toBe(username)

    const stored = await readStoredDocument(neuron.id)

    expect(stored).toEqual(neuron.toDocument())
  })

  it('reads its own write back into an equivalent neuron', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })
    const neuron = await connection
      .getDatabase(databaseName)
      .create(StringNeuron.create({ value: 'round trip' }))

    const stored = await readStoredDocument(neuron.id)

    expect(StringNeuron.fromDocument(stored).toDocument()).toEqual(neuron.toDocument())
  })

  it('refuses to write without a session', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({ url: couchUrl })

    // Specifically a 401 from CouchDB, not just any failure: without this the
    // test would still pass if the write broke for some unrelated reason.
    await expect(
      connection.getDatabase(databaseName).create(StringNeuron.create({ value: 'nope' }))
    ).rejects.toThrow(/not authorized.*\(401\)/)
  })
})

describe('Database reads against a real CouchDB', () => {
  // Mango selectors are the part that cannot be trusted from the local adapter
  // alone: CouchDB runs its own query engine, and index creation there is a
  // real HTTP round trip against _index.
  async function connect() {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })
    return connection.getDatabase(databaseName)
  }

  it('gets a neuron back by id', async () => {
    const database = await connect()
    const written = await database.create(StringNeuron.create({ value: 'findable' }))

    const read = await database.get(written.id)

    expect(read?.toDocument()).toEqual(written.toDocument())
    await database.close()
  })

  it('returns null for an id CouchDB does not have', async () => {
    const database = await connect()

    await expect(database.get('definitely-not-there')).resolves.toBeNull()
    await database.close()
  })

  it('finds children by parent_id through a Mango index', async () => {
    const database = await connect()
    const parentId = `parent-${Date.now()}`
    const child = await database.create(StringNeuron.create({ value: 'child', parentId }))
    await database.create(StringNeuron.create({ value: 'elsewhere', parentId: 'other-parent' }))

    const neurons = await database.listByParentId(parentId)

    expect(neurons.map((neuron) => neuron.id)).toEqual([child.id])
    await database.close()
  })

  it('finds root neurons with an explicit null parent_id', async () => {
    const database = await connect()
    const root = await database.create(StringNeuron.create({ value: 'a root' }))

    const neurons = await database.listByParentId(null)

    expect(neurons.map((neuron) => neuron.id)).toContain(root.id)
    await database.close()
  })

  it('lists neurons without tripping on the Mango design document', async () => {
    // createIndex leaves a _design doc behind in the same database; list() has
    // to skip it rather than hand it to the neuron factory.
    const database = await connect()
    const written = await database.create(StringNeuron.create({ value: 'listed' }))
    await database.listByParentId(null)

    const neurons = await database.list()

    expect(neurons.map((neuron) => neuron.id)).toContain(written.id)
    await database.close()
  })
})
