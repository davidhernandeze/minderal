import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../src/index.js'
import type { StringNeuronDocument } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const databaseNames: string[] = []

function useDatabase(name: string) {
  databaseNames.push(name)
  return connection.getDatabase(name)
}

// Read back through a separate client, so the assertions see what actually
// landed on disk rather than the in-memory neuron we just wrote.
async function readStoredDocument(
  databaseName: string,
  id: string
): Promise<StringNeuronDocument> {
  const client = new PouchDB<StringNeuronDocument>(databaseName, { adapter: 'memory' })
  try {
    return await client.get(id)
  } finally {
    await client.close()
  }
}

afterEach(async () => {
  for (const name of databaseNames) {
    await new PouchDB(name, { adapter: 'memory' }).destroy()
  }
  databaseNames.length = 0
})

describe('Database.createNeuron', () => {
  it('writes the document and stamps the neuron', async () => {
    const database = useDatabase('create-neuron')
    const neuron = StringNeuron.create({ value: 'hello' })

    const saved = await database.createNeuron(neuron)

    expect(saved).toBe(neuron)
    expect(saved.revision).toMatch(/^1-/)
    expect(saved.createdBy).toBe('local')
    expect(saved.createdAt).not.toBeNull()
    expect(saved.updatedAt).toBe(saved.createdAt)
  })

  it('stores exactly the document the neuron maps to', async () => {
    const database = useDatabase('stored-shape')
    const neuron = await database.createNeuron(
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
    const neuron = await database.createNeuron(StringNeuron.create({ value: 'hello' }))

    const reloaded = StringNeuron.fromDocument(await readStoredDocument('round-trip', neuron.id))

    expect(reloaded.toDocument()).toEqual(neuron.toDocument())
  })

  it('ignores a createdBy the caller set, using the connection user', async () => {
    const database = useDatabase('created-by')
    const neuron = StringNeuron.create({ value: 'hello' })
    neuron.createdBy = 'someone-else'

    await database.createNeuron(neuron)

    expect(neuron.createdBy).toBe('local')
  })

  it('fails when a neuron with that id already exists', async () => {
    const database = useDatabase('conflict')
    const neuron = StringNeuron.create({ value: 'hello' })
    await database.createNeuron(neuron)

    const duplicate = StringNeuron.create({ value: 'other' })
    duplicate.id = neuron.id

    await expect(database.createNeuron(duplicate)).rejects.toThrow(
      /Document update conflict \(409\)/
    )
  })

  it('keeps separate databases separate', async () => {
    const first = useDatabase('separate-a')
    const second = useDatabase('separate-b')
    const neuron = await first.createNeuron(StringNeuron.create({ value: 'hello' }))

    await expect(readStoredDocument('separate-b', neuron.id)).rejects.toMatchObject({
      status: 404
    })
    await expect(second.createNeuron(StringNeuron.create({ value: 'x' }))).resolves.toBeDefined()
  })
})
