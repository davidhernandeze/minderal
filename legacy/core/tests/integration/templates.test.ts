import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  BOOLEAN_NEURON_TYPE,
  BooleanNeuron,
  ConnectionFactory,
  OBJECT_NEURON_TYPE,
  ObjectNeuron,
  STRING_NEURON_TYPE,
  StringNeuron,
  Template
} from '../../src/index.js'
import type { Database } from '../../src/index.js'

// Templates share a database with neurons and are kept apart only by their id
// prefix, so the separation has to hold against CouchDB's own _all_docs ranges
// rather than PouchDB's.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const databaseName = 'templates-integration'

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

describe('Templates against a real CouchDB', () => {
  it('keeps each kind out of the other listing', async () => {
    const database = await connect()
    await database.create(StringNeuron.create({ name: 'David' }))
    await database.createTemplate(Template.create({ name: 'person' }))

    expect((await database.list()).map((neuron) => neuron.name)).toContain('David')
    expect((await database.list()).map((neuron) => neuron.name)).not.toContain('person')
    expect((await database.listTemplates()).map((template) => template.name)).toEqual(['person'])
  })

  it('makes a neuron from a type, defaults and nesting included', async () => {
    const database = await connect()
    const address = await database.createTemplate(
      Template.create({
        name: 'address',
        attributes: [
          { name: 'city', type: STRING_NEURON_TYPE, templateId: null, defaultValue: 'Madrid' }
        ]
      })
    )
    const person = await database.createTemplate(
      Template.create({
        name: 'person',
        attributes: [
          { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null, defaultValue: true },
          { name: 'home', type: OBJECT_NEURON_TYPE, templateId: address.id, defaultValue: null }
        ]
      })
    )

    const made = await database.createFromTemplate(person, { name: 'Someone' })

    const stored = await adminRequest(`/${databaseName}/${made.id}`, 'GET').then((r) => r.json())
    expect(stored.type).toBe(OBJECT_NEURON_TYPE)
    expect(stored.template_id).toBe(person.id)

    const attributes = await database.listAttributes(made)
    const alive = attributes.find((attribute) => attribute.name === 'alive')
    const home = attributes.find((attribute) => attribute.name === 'home')
    expect(alive?.neuron).toBeInstanceOf(BooleanNeuron)
    expect(home?.neuron).toBeInstanceOf(ObjectNeuron)

    const inside = home === undefined ? [] : await database.listAttributes(home.neuron)
    expect(inside.map((attribute) => attribute.name)).toEqual(['city'])
  })
})
