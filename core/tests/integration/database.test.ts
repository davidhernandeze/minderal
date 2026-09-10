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

describe('Database.createNeuron against a real CouchDB', () => {
  it('writes a neuron the server accepts and stores verbatim', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })
    const database = connection.getDatabase(databaseName)

    const neuron = await database.createNeuron(
      StringNeuron.create({ value: 'hello from integration', parentId: null })
    )

    expect(neuron.revision).toMatch(/^1-/)
    // createdBy comes from the verified session, not from the caller.
    expect(neuron.createdBy).toBe(username)

    const stored: StringNeuronDocument = await adminRequest(
      `/${databaseName}/${neuron.id}`,
      'GET'
    ).then((response) => response.json())

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
      .createNeuron(StringNeuron.create({ value: 'round trip' }))

    const stored: StringNeuronDocument = await adminRequest(
      `/${databaseName}/${neuron.id}`,
      'GET'
    ).then((response) => response.json())

    expect(StringNeuron.fromDocument(stored).toDocument()).toEqual(neuron.toDocument())
  })

  it('refuses to write without a session', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({ url: couchUrl })

    // Specifically a 401 from CouchDB, not just any failure: without this the
    // test would still pass if the write broke for some unrelated reason.
    await expect(
      connection.getDatabase(databaseName).createNeuron(StringNeuron.create({ value: 'nope' }))
    ).rejects.toThrow(/not authorized.*\(401\)/)
  })
})
