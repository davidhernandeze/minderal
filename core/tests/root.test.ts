import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ConnectionFactory,
  NEURON_ROOT_ID,
  NeuronError,
  ObjectNeuron,
  StringNeuron
} from '../src/index.js'
import type { Database } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const databaseNames: string[] = []

function useDatabase(name: string): Database {
  databaseNames.push(name)
  return connection.getDatabase(name)
}

afterEach(async () => {
  await connection.close()
  for (const name of databaseNames) {
    await new PouchDB(name, { adapter: 'memory' }).destroy()
  }
  databaseNames.length = 0
})

describe('The root neuron', () => {
  it('exists as soon as the database is opened', async () => {
    const database = useDatabase('root-exists')

    const root = await database.getRoot()

    expect(root.id).toBe(NEURON_ROOT_ID)
    expect(root).toBeInstanceOf(ObjectNeuron)
    expect(root.parentId).toBeNull()
    expect(root.createdBy).toBe('local')
  })

  it('is created once, however many operations run', async () => {
    const database = useDatabase('root-once')
    const first = await database.getRoot()

    await database.create(StringNeuron.create({ name: 'a' }))
    await database.list()
    const second = await database.getRoot()

    expect(second.revision).toBe(first.revision)
  })

  // Everything that lists neurons scans the whole prefix, so the one document
  // the tree hangs off would otherwise show up as a thing in the tree.
  it('is not one of the neurons a listing returns', async () => {
    const database = useDatabase('root-hidden')
    await database.create(StringNeuron.create({ name: 'a' }))

    expect((await database.list()).map((neuron) => neuron.id)).not.toContain(NEURON_ROOT_ID)
    expect((await database.listByParentId(null)).map((neuron) => neuron.id)).not.toContain(
      NEURON_ROOT_ID
    )
  })

  // The replication case: a root written elsewhere arrives first. Opening the
  // database must leave it alone rather than writing a second one over it.
  it('leaves a root that is already there alone', async () => {
    databaseNames.push('root-existing')
    const raw = new PouchDB('root-existing', { adapter: 'memory' })
    const written = await raw.put({
      _id: NEURON_ROOT_ID,
      type: 'object',
      name: 'from somewhere else',
      parent_id: null,
      previous_parent_id: null,
      attributes: [],
      attribute_of: null,
      template_id: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      created_by: 'another peer',
      deleted_at: null
    })

    const root = await useDatabase('root-existing').getRoot()

    expect(root.revision).toBe(written.rev)
    expect(root.name).toBe('from somewhere else')
    expect(root.createdBy).toBe('another peer')
  })

  it('cannot be deleted', async () => {
    const database = useDatabase('root-undeletable')
    const root = await database.getRoot()

    await expect(database.delete(root)).rejects.toThrow(NeuronError)
    expect((await database.getRoot()).deletedAt).toBeNull()
  })

  it('holds the tree, while a neuron with no parent is simply unfiled', async () => {
    const database = useDatabase('root-children')
    const inTree = await database.create(
      ObjectNeuron.create({ name: 'in the tree', parentId: NEURON_ROOT_ID })
    )
    const unfiled = await database.create(ObjectNeuron.create({ name: 'unfiled' }))

    expect((await database.listByParentId(NEURON_ROOT_ID)).map((n) => n.id)).toEqual([inTree.id])
    expect((await database.listByParentId(null)).map((n) => n.id)).toEqual([unfiled.id])
  })

  // The value of an attribute is the other thing parent_id null now means, and
  // it must not turn up as an unfiled neuron.
  it('keeps an attribute value out of the unfiled ones', async () => {
    const database = useDatabase('root-attribute')
    const owner = await database.create(
      ObjectNeuron.create({ name: 'David', parentId: NEURON_ROOT_ID })
    )
    await database.setAttribute(owner, 'city', StringNeuron.create({ value: 'Madrid' }))

    expect(await database.listByParentId(null)).toEqual([])
  })

  it('takes the whole subtree with it when a child is deleted', async () => {
    const database = useDatabase('root-delete-child')
    const parent = await database.create(
      ObjectNeuron.create({ name: 'parent', parentId: NEURON_ROOT_ID })
    )
    await database.create(ObjectNeuron.create({ name: 'child', parentId: parent.id }))

    await database.delete(parent)

    expect(await database.listByParentId(NEURON_ROOT_ID)).toEqual([])
    expect(await database.getRoot()).not.toBeNull()
  })
})
