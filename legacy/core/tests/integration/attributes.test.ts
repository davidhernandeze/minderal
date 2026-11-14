import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../../src/index.js'
import type { Database } from '../../src/index.js'

// The delete sweep finds attribute values with a Mango $in on attribute_of, so
// it needs proving against CouchDB's own query engine, not just PouchDB's.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const databaseName = 'attributes-integration'

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

describe('Attributes against a real CouchDB', () => {
  it('stores the link on the owner and the value in its own document', async () => {
    const database = await connect()
    const owner = await database.create(StringNeuron.create({ name: `David ${Date.now()}` }))

    const birthday = await database.setAttribute(
      owner,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    const stored = await adminRequest(`/${databaseName}/${owner.id}`, 'GET').then((r) => r.json())
    expect(stored.attributes).toEqual([{ name: 'birthday', id: birthday.id }])

    const value = await adminRequest(`/${databaseName}/${birthday.id}`, 'GET').then((r) =>
      r.json()
    )
    expect(value.attribute_of).toBe(owner.id)
    expect(value.parent_id).toBeNull()
    await database.close()
  })

  it('keeps the value out of the top level despite its null parent_id', async () => {
    const database = await connect()
    const owner = await database.create(StringNeuron.create({ name: `Hidden ${Date.now()}` }))
    const birthday = await database.setAttribute(
      owner,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    const roots = await database.listByParentId(null)

    expect(roots.map((neuron) => neuron.id)).toContain(owner.id)
    expect(roots.map((neuron) => neuron.id)).not.toContain(birthday.id)
    await database.close()
  })

  it('sweeps attribute values when the owner is deleted', async () => {
    const database = await connect()
    const owner = await database.create(StringNeuron.create({ name: `Doomed ${Date.now()}` }))
    const birthday = await database.setAttribute(
      owner,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    await database.delete(owner)

    const stored = await adminRequest(`/${databaseName}/${birthday.id}`, 'GET').then((r) =>
      r.json()
    )
    // Still in CouchDB, flagged — the same soft delete as anything else.
    expect(stored.deleted_at).not.toBeNull()
    await expect(database.get(birthday.id, { includeAttributes: true })).resolves.toBeNull()
    await database.close()
  })

  it('resolves several attributes in a single read', async () => {
    const database = await connect()
    const owner = await database.create(StringNeuron.create({ name: `Many ${Date.now()}` }))
    await database.setAttribute(owner, 'birthday', StringNeuron.create({ value: '1994-03-12' }))
    await database.setAttribute(owner, 'city', StringNeuron.create({ value: 'Madrid' }))

    const resolved = await database.listAttributes(owner)

    expect(resolved.map((entry) => entry.name)).toEqual(['birthday', 'city'])
    await database.close()
  })
})
