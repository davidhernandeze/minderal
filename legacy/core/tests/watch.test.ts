import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron, Template } from '../src/index.js'
import type { Database, NeuronChange, TemplateChange } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const databaseNames: string[] = []

function useDatabase(name: string): Database {
  databaseNames.push(name)
  return connection.getDatabase(name)
}

// The feed is asynchronous, so tests wait for the change they expect rather
// than sleeping for a fixed time.
function collectChanges(database: Database) {
  const changes: NeuronChange[] = []
  const errors: Error[] = []
  const stopping = database.watch({
    change: (change) => changes.push(change),
    error: (error) => errors.push(error)
  })

  return {
    changes,
    errors,
    async waitFor(count: number, timeoutMs = 3000): Promise<void> {
      const deadline = Date.now() + timeoutMs
      while (changes.length < count) {
        if (Date.now() > deadline) throw new Error(`only ${changes.length} of ${count} changes`)
        await new Promise((resolve) => setTimeout(resolve, 15))
      }
    },
    async stop(): Promise<void> {
      ;(await stopping)()
    }
  }
}

afterEach(async () => {
  await connection.close()
  for (const name of databaseNames) {
    await new PouchDB(name, { adapter: 'memory' }).destroy()
  }
  databaseNames.length = 0
})

describe('Database.watch', () => {
  it('reports a created neuron with the fields a listener needs to decide', async () => {
    const database = useDatabase('watch-create')
    const watcher = collectChanges(database)

    const neuron = await database.create(StringNeuron.create({ value: 'hi', parentId: 'p1' }))
    await watcher.waitFor(1)

    expect(watcher.changes[0]).toMatchObject({
      id: neuron.id,
      parentId: 'p1',
      previousParentId: null,
      deletedAt: null
    })
    expect(watcher.changes[0]?.neuron).toBeInstanceOf(StringNeuron)
    await watcher.stop()
  })

  it('reports a soft delete as a change carrying deletedAt', async () => {
    // Soft deletes are ordinary updates, so change.deleted is false for them.
    // A listener filtering on that flag would never see a deletion.
    const database = useDatabase('watch-delete')
    const neuron = await database.create(StringNeuron.create({ value: 'bye' }))
    const watcher = collectChanges(database)

    await database.delete(neuron)
    await watcher.waitFor(1)

    expect(watcher.changes[0]?.deletedAt).not.toBeNull()
    expect(watcher.changes[0]?.id).toBe(neuron.id)
    await watcher.stop()
  })

  it('reports every neuron in a deleted subtree', async () => {
    const database = useDatabase('watch-subtree')
    const root = await database.create(StringNeuron.create({ value: 'root' }))
    const child = await database.create(StringNeuron.create({ value: 'child', parentId: root.id }))
    const watcher = collectChanges(database)

    await database.delete(root)
    await watcher.waitFor(2)

    const deletedIds = watcher.changes.map((change) => change.id).sort()
    expect(deletedIds).toEqual([root.id, child.id].sort())
    await watcher.stop()
  })

  it('stops reporting once unsubscribed', async () => {
    const database = useDatabase('watch-stop')
    const watcher = collectChanges(database)
    await database.create(StringNeuron.create({ value: 'first' }))
    await watcher.waitFor(1)

    await watcher.stop()
    await database.create(StringNeuron.create({ value: 'second' }))
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(watcher.changes).toHaveLength(1)
  })

  it('gives every listener the same change from one feed', async () => {
    const database = useDatabase('watch-fanout')
    const first = collectChanges(database)
    const second = collectChanges(database)

    await database.create(StringNeuron.create({ value: 'shared' }))
    await first.waitFor(1)
    await second.waitFor(1)

    expect(first.changes[0]?.id).toBe(second.changes[0]?.id)
    await first.stop()
    await second.stop()
  })

  it('reports a rename, carrying the new name', async () => {
    // The UI refetches from this rather than from the write that caused it.
    const database = useDatabase('watch-rename')
    const neuron = await database.create(StringNeuron.create({ name: 'before' }))
    const watcher = collectChanges(database)

    await database.rename(neuron, 'after')
    await watcher.waitFor(1)

    expect(watcher.changes[0]?.id).toBe(neuron.id)
    expect(watcher.changes[0]?.neuron?.name).toBe('after')
    await watcher.stop()
  })

  it('does not report the index design document', async () => {
    const database = useDatabase('watch-design')
    const watcher = collectChanges(database)

    // createIndex writes a _design doc; it is not a neuron.
    await database.listByParentId('nobody')
    await database.create(StringNeuron.create({ value: 'only this' }))
    await watcher.waitFor(1)

    expect(watcher.changes).toHaveLength(1)
    await watcher.stop()
  })
})

describe('Database.watch on templates', () => {
  it('sends template changes to the template handler and nowhere else', async () => {
    const database = useDatabase('watch-templates')
    const neuronChanges: NeuronChange[] = []
    const templateChanges: TemplateChange[] = []
    const stop = await database.watch({
      change: (change) => neuronChanges.push(change),
      template: (change) => templateChanges.push(change)
    })

    const template = await database.createTemplate(Template.create({ name: 'person' }))
    await waitUntil(() => templateChanges.length >= 1)

    expect(templateChanges[0]?.id).toBe(template.id)
    expect(templateChanges[0]?.template?.name).toBe('person')
    // A template is not a neuron, so the neuron watcher never hears about it.
    expect(neuronChanges).toEqual([])

    await database.create(StringNeuron.create({ name: 'David' }))
    await waitUntil(() => neuronChanges.length >= 1)
    expect(templateChanges).toHaveLength(1)

    stop()
  })

  it('reaches a watcher that asked only for neurons without failing', async () => {
    const database = useDatabase('watch-templates-optional')
    const neuronChanges: NeuronChange[] = []
    const errors: Error[] = []
    const stop = await database.watch({
      change: (change) => neuronChanges.push(change),
      error: (error) => errors.push(error)
    })

    await database.createTemplate(Template.create({ name: 'person' }))
    await database.create(StringNeuron.create({ name: 'David' }))
    await waitUntil(() => neuronChanges.length >= 1)

    expect(errors).toEqual([])
    expect(neuronChanges).toHaveLength(1)

    stop()
  })
})

async function waitUntil(done: () => boolean, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!done()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for a change')
    await new Promise((resolve) => setTimeout(resolve, 15))
  }
}
