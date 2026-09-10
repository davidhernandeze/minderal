import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionFactory, NeuronError, StringNeuron } from '../src/index.js'
import type { Database } from '../src/index.js'
import type { StringNeuronDocument } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const databaseNames: string[] = []

function useDatabase(name: string): Database {
  databaseNames.push(name)
  return connection.getDatabase(name)
}

// Read back through a separate client, so the assertions see what actually
// landed on disk rather than the in-memory neuron we just wrote. Deliberately
// left open: close() tears down the store shared by every client on that name,
// which would break the Database handle still using it. afterEach destroys it.
async function readStoredDocument(
  databaseName: string,
  id: string
): Promise<StringNeuronDocument> {
  const client = new PouchDB<StringNeuronDocument>(databaseName, { adapter: 'memory' })
  return client.get(id)
}

afterEach(async () => {
  // Close the connection's handles before destroying: a Database keeps its
  // PouchDB client open for its lifetime, and closing one client tears down
  // the store shared by every client on that name.
  await connection.close()
  for (const name of databaseNames) {
    await new PouchDB(name, { adapter: 'memory' }).destroy()
  }
  databaseNames.length = 0
})

describe('Database.createNeuron', () => {
  it('writes the document and stamps the neuron', async () => {
    const database = useDatabase('create-neuron')
    const neuron = StringNeuron.create({ value: 'hello' })

    const saved = await database.create(neuron)

    expect(saved).toBe(neuron)
    expect(saved.revision).toMatch(/^1-/)
    expect(saved.createdBy).toBe('local')
    expect(saved.createdAt).not.toBeNull()
    expect(saved.updatedAt).toBe(saved.createdAt)
  })

  it('stores exactly the document the neuron maps to', async () => {
    const database = useDatabase('stored-shape')
    const neuron = await database.create(
      StringNeuron.create({ value: 'hello', name: 'Greeting', parentId: 'parent-1' })
    )

    const stored = await readStoredDocument('stored-shape', neuron.id)

    expect(stored).toEqual({
      _id: neuron.id,
      _rev: neuron.revision,
      type: 'string',
      value: 'hello',
      name: 'Greeting',
      parent_id: 'parent-1',
      created_at: neuron.createdAt,
      updated_at: neuron.updatedAt,
      created_by: 'local'
    })
  })

  it('round-trips through the database', async () => {
    const database = useDatabase('round-trip')
    const neuron = await database.create(StringNeuron.create({ value: 'hello' }))

    const reloaded = StringNeuron.fromDocument(await readStoredDocument('round-trip', neuron.id))

    expect(reloaded.toDocument()).toEqual(neuron.toDocument())
  })

  it('ignores a createdBy the caller set, using the connection user', async () => {
    const database = useDatabase('created-by')
    const neuron = StringNeuron.create({ value: 'hello' })
    neuron.createdBy = 'someone-else'

    await database.create(neuron)

    expect(neuron.createdBy).toBe('local')
  })

  it('fails when a neuron with that id already exists', async () => {
    const database = useDatabase('conflict')
    const neuron = StringNeuron.create({ value: 'hello' })
    await database.create(neuron)

    const duplicate = StringNeuron.create({ value: 'other' })
    duplicate.id = neuron.id

    await expect(database.create(duplicate)).rejects.toThrow(
      /Document update conflict \(409\)/
    )
  })

  it('keeps separate databases separate', async () => {
    const first = useDatabase('separate-a')
    const second = useDatabase('separate-b')
    const neuron = await first.create(StringNeuron.create({ value: 'hello' }))

    await expect(readStoredDocument('separate-b', neuron.id)).rejects.toMatchObject({
      status: 404
    })
    await expect(second.create(StringNeuron.create({ value: 'x' }))).resolves.toBeDefined()
  })
})

describe('Database.get', () => {
  it('reads a neuron back as the type it was written as', async () => {
    const database = useDatabase('get-neuron')
    const written = await database.create(StringNeuron.create({ value: 'hello', name: 'Greeting' }))

    const read = await database.get(written.id)

    // The document's `type` discriminator is what selects the class.
    expect(read).toBeInstanceOf(StringNeuron)
    expect(read?.toDocument()).toEqual(written.toDocument())
  })

  it('returns null for an id that is not there', async () => {
    const database = useDatabase('get-missing')

    await expect(database.get('nope')).resolves.toBeNull()
  })

  it('throws on a document that is not a neuron we can read', async () => {
    // A missing id is an ordinary answer; an unreadable document is not, and
    // silently skipping it would hide data we cannot represent.
    const database = useDatabase('get-foreign')
    const client = new PouchDB('get-foreign', { adapter: 'memory' })
    await client.put({ _id: 'foreign-1', type: 'not-a-neuron-type' })

    await expect(database.get('foreign-1')).rejects.toThrow(NeuronError)
  })
})

describe('Database.list', () => {
  it('returns every neuron, sorted by id', async () => {
    const database = useDatabase('list-all')
    const first = await database.create(StringNeuron.create({ value: 'a' }))
    const second = await database.create(StringNeuron.create({ value: 'b' }))
    const expectedIds = [first.id, second.id].sort()

    const neurons = await database.list()

    expect(neurons.map((neuron) => neuron.id)).toEqual(expectedIds)
  })

  it('is empty for a database with nothing in it', async () => {
    const database = useDatabase('list-empty')

    await expect(database.list()).resolves.toEqual([])
  })

  it('skips design documents', async () => {
    // allDocs returns _design docs; they are not neurons and must not reach
    // the factory, which would throw on them.
    const database = useDatabase('list-design')
    const client = new PouchDB('list-design', { adapter: 'memory' })
    await client.put({ _id: '_design/some-view', views: {} })
    await database.create(StringNeuron.create({ value: 'a' }))

    const neurons = await database.list()

    expect(neurons).toHaveLength(1)
  })
})

describe('Database.listByParentId', () => {
  it('returns only the children of that parent', async () => {
    const database = useDatabase('by-parent')
    const child = await database.create(StringNeuron.create({ value: 'child', parentId: 'p1' }))
    await database.create(StringNeuron.create({ value: 'other', parentId: 'p2' }))
    await database.create(StringNeuron.create({ value: 'root' }))

    const neurons = await database.listByParentId('p1')

    expect(neurons.map((neuron) => neuron.id)).toEqual([child.id])
  })

  it('finds root neurons with a null parentId', async () => {
    // Mango has to match an explicit null, not just treat it as "no filter".
    const database = useDatabase('by-parent-null')
    const root = await database.create(StringNeuron.create({ value: 'root' }))
    await database.create(StringNeuron.create({ value: 'child', parentId: root.id }))

    const neurons = await database.listByParentId(null)

    expect(neurons.map((neuron) => neuron.id)).toEqual([root.id])
  })

  it('returns an empty list for a parent with no children', async () => {
    const database = useDatabase('by-parent-empty')
    await database.create(StringNeuron.create({ value: 'root' }))

    await expect(database.listByParentId('nobody')).resolves.toEqual([])
  })

  it('sorts children by id', async () => {
    const database = useDatabase('by-parent-sorted')
    const created = await Promise.all([
      database.create(StringNeuron.create({ value: 'a', parentId: 'p1' })),
      database.create(StringNeuron.create({ value: 'b', parentId: 'p1' })),
      database.create(StringNeuron.create({ value: 'c', parentId: 'p1' }))
    ])

    const neurons = await database.listByParentId('p1')

    expect(neurons.map((neuron) => neuron.id)).toEqual(created.map((n) => n.id).sort())
  })
})

describe('Connection.getDatabase', () => {
  it('hands back the same handle for the same name', () => {
    // One PouchDB client per database, not one per call: separate clients on
    // the same name fight each other on close.
    const first = useDatabase('same-handle')

    expect(connection.getDatabase('same-handle')).toBe(first)
  })

  it('hands back different handles for different names', () => {
    expect(useDatabase('handle-a')).not.toBe(useDatabase('handle-b'))
  })

  it('reopens after the connection is closed', async () => {
    const database = useDatabase('reopen')
    const written = await database.create(StringNeuron.create({ value: 'kept' }))

    await connection.close()

    // A closed handle is still usable - it opens a fresh client on next use.
    await expect(database.get(written.id)).resolves.not.toBeNull()
  })

  it('runs concurrent writes on one handle without deadlocking', async () => {
    const database = useDatabase('concurrent')

    const written = await Promise.all([
      database.create(StringNeuron.create({ value: 'a' })),
      database.create(StringNeuron.create({ value: 'b' })),
      database.create(StringNeuron.create({ value: 'c' }))
    ])

    expect(written).toHaveLength(3)
    await expect(database.list()).resolves.toHaveLength(3)
  })
})
