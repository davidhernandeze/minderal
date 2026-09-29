import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionFactory, NEURON_ID_PREFIX, NeuronError, StringNeuron } from '../src/index.js'
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
      previous_parent_id: null,
      attributes: [],
      attribute_of: null,
      created_at: neuron.createdAt,
      updated_at: neuron.updatedAt,
      created_by: 'local',
      deleted_at: null
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
  it('returns every neuron', async () => {
    const database = useDatabase('list-all')
    const first = await database.create(StringNeuron.create({ value: 'a' }))
    const second = await database.create(StringNeuron.create({ value: 'b' }))

    const neurons = await database.list()

    // Membership only: whether these two share a millisecond decides the
    // order, and the Ordering suite covers that deliberately.
    expect(neurons.map((neuron) => neuron.id).sort()).toEqual([first.id, second.id].sort())
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

  it('returns a stable order for children sharing a timestamp', async () => {
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

describe('Database.delete', () => {
  it('marks the neuron deleted instead of removing the document', async () => {
    const database = useDatabase('soft-delete')
    const neuron = await database.create(StringNeuron.create({ value: 'goodbye' }))
    const revisionBefore = neuron.revision

    await database.delete(neuron)

    expect(neuron.deletedAt).not.toBeNull()
    expect(neuron.revision).not.toBe(revisionBefore)
    // The document is still there, just flagged.
    const stored = await readStoredDocument('soft-delete', neuron.id)
    expect(stored.deleted_at).toBe(neuron.deletedAt)
    expect(stored.value).toBe('goodbye')
  })

  it('hides the neuron from get', async () => {
    const database = useDatabase('delete-get')
    const neuron = await database.create(StringNeuron.create({ value: 'gone' }))
    await database.delete(neuron)

    await expect(database.get(neuron.id)).resolves.toBeNull()
  })

  it('still returns it when deleted are asked for', async () => {
    const database = useDatabase('delete-include')
    const neuron = await database.create(StringNeuron.create({ value: 'gone' }))
    await database.delete(neuron)

    const read = await database.get(neuron.id, { includeDeleted: true })

    expect(read?.deletedAt).toBe(neuron.deletedAt)
  })

  it('hides the neuron from list and listByParentId', async () => {
    const database = useDatabase('delete-lists')
    const kept = await database.create(StringNeuron.create({ value: 'kept', parentId: 'p1' }))
    const removed = await database.create(StringNeuron.create({ value: 'removed', parentId: 'p1' }))
    await database.delete(removed)

    await expect(database.list()).resolves.toHaveLength(1)
    const children = await database.listByParentId('p1')
    expect(children.map((neuron) => neuron.id)).toEqual([kept.id])
  })

  it('includes deleted in both listings on request', async () => {
    const database = useDatabase('delete-lists-include')
    await database.create(StringNeuron.create({ value: 'kept', parentId: 'p1' }))
    const removed = await database.create(StringNeuron.create({ value: 'removed', parentId: 'p1' }))
    await database.delete(removed)

    await expect(database.list({ includeDeleted: true })).resolves.toHaveLength(2)
    await expect(database.listByParentId('p1', { includeDeleted: true })).resolves.toHaveLength(2)
  })
})

describe('Database.initialize', () => {
  it('creates the indexes the queries rely on', async () => {
    const database = useDatabase('init-indexes')
    await database.initialize()

    const client = new PouchDB('init-indexes', { adapter: 'memory' })
    const { indexes } = await client.getIndexes()
    const fields = indexes.map((index) => index.def.fields.map((f) => Object.keys(f)[0]).join(','))

    expect(fields).toContain('parent_id,deleted_at')
    expect(fields).toContain('deleted_at')
  })

  it('runs once however many operations follow', async () => {
    const database = useDatabase('init-once')
    await Promise.all([
      database.create(StringNeuron.create({ value: 'a' })),
      database.create(StringNeuron.create({ value: 'b' }))
    ])

    await expect(database.list()).resolves.toHaveLength(2)
  })
})

describe('Database.delete recursion', () => {
  it('soft deletes the whole subtree, not just the neuron', async () => {
    const database = useDatabase('delete-subtree')
    const root = await database.create(StringNeuron.create({ value: 'root' }))
    const child = await database.create(
      StringNeuron.create({ value: 'child', parentId: root.id })
    )
    const grandchild = await database.create(
      StringNeuron.create({ value: 'grandchild', parentId: child.id })
    )

    await database.delete(root)

    for (const id of [root.id, child.id, grandchild.id]) {
      await expect(database.get(id)).resolves.toBeNull()
      const stored = await readStoredDocument('delete-subtree', id)
      expect(stored.deleted_at).not.toBeNull()
    }
  })

  it('leaves neurons outside the subtree alone', async () => {
    const database = useDatabase('delete-sibling')
    const target = await database.create(StringNeuron.create({ value: 'target' }))
    await database.create(StringNeuron.create({ value: 'child', parentId: target.id }))
    const bystander = await database.create(StringNeuron.create({ value: 'bystander' }))

    await database.delete(target)

    await expect(database.get(bystander.id)).resolves.not.toBeNull()
    await expect(database.list()).resolves.toHaveLength(1)
  })

  it('keeps the original timestamp on an already deleted descendant', async () => {
    const database = useDatabase('delete-twice')
    const root = await database.create(StringNeuron.create({ value: 'root' }))
    const child = await database.create(
      StringNeuron.create({ value: 'child', parentId: root.id })
    )
    await database.delete(child)
    const firstDeletedAt = child.deletedAt

    await database.delete(root)

    const stored = await readStoredDocument('delete-twice', child.id)
    expect(stored.deleted_at).toBe(firstDeletedAt)
  })

  it('deletes past the 25 document find() default', async () => {
    // find() returns 25 rows when given no limit, on PouchDB and CouchDB
    // alike. Without paging, a wide subtree is only partly deleted.
    const database = useDatabase('delete-wide')
    const root = await database.create(StringNeuron.create({ value: 'root' }))
    const children = await Promise.all(
      Array.from({ length: 40 }, (unused, index) =>
        database.create(StringNeuron.create({ value: `child ${index}`, parentId: root.id }))
      )
    )

    await database.delete(root)

    const remaining = await database.listByParentId(root.id)
    expect(remaining).toEqual([])
    for (const child of children) {
      await expect(database.get(child.id)).resolves.toBeNull()
    }
  })

  it('terminates on a parent_id cycle', async () => {
    // Nothing in core stops two neurons pointing at each other.
    const database = useDatabase('delete-cycle')
    const first = await database.create(StringNeuron.create({ value: 'first' }))
    const second = await database.create(
      StringNeuron.create({ value: 'second', parentId: first.id })
    )
    first.parentId = second.id
    await database.create(first)

    await expect(database.delete(second)).resolves.toBeDefined()
    await expect(database.list()).resolves.toEqual([])
  })
})

describe('Database.listByParentId paging', () => {
  it('returns every child past the 25 document find() default', async () => {
    const database = useDatabase('list-wide')
    await Promise.all(
      Array.from({ length: 40 }, (unused, index) =>
        database.create(StringNeuron.create({ value: `child ${index}`, parentId: 'wide' }))
      )
    )

    await expect(database.listByParentId('wide')).resolves.toHaveLength(40)
  })
})

describe('Ordering', () => {
  // created_at is written by Database.create, so the timestamps are seeded
  // directly here to make the order deterministic rather than time-dependent.
  async function seed(databaseName: string, entries: Array<[string, string]>): Promise<void> {
    const client = new PouchDB<Record<string, unknown>>(databaseName, { adapter: 'memory' })
    for (const [id, createdAt] of entries) {
      await client.put({
        _id: `${NEURON_ID_PREFIX}${id}`,
        type: 'string',
        value: id,
        name: null,
        parent_id: 'p1',
        previous_parent_id: null,
        created_at: createdAt,
        updated_at: createdAt,
        created_by: 'local',
        deleted_at: null
      })
    }
  }

  it('lists children newest first', async () => {
    const database = useDatabase('order-children')
    await seed('order-children', [
      ['oldest', '2026-01-01T00:00:00.000Z'],
      ['newest', '2026-03-01T00:00:00.000Z'],
      ['middle', '2026-02-01T00:00:00.000Z']
    ])

    const children = await database.listByParentId('p1')

    expect(children.map((neuron) => neuron.id)).toEqual(
      ['newest', 'middle', 'oldest'].map((id) => `${NEURON_ID_PREFIX}${id}`)
    )
  })

  it('lists everything newest first too', async () => {
    const database = useDatabase('order-all')
    await seed('order-all', [
      ['b-older', '2026-01-01T00:00:00.000Z'],
      ['a-newer', '2026-02-01T00:00:00.000Z']
    ])

    const all = await database.list()

    // Newest wins over the alphabetically earlier id.
    expect(all.map((neuron) => neuron.id)).toEqual(
      ['a-newer', 'b-older'].map((id) => `${NEURON_ID_PREFIX}${id}`)
    )
  })

  it('falls back to id when timestamps match', async () => {
    const database = useDatabase('order-tie')
    await seed('order-tie', [
      ['zeta', '2026-01-01T00:00:00.000Z'],
      ['alpha', '2026-01-01T00:00:00.000Z']
    ])

    const children = await database.listByParentId('p1')

    expect(children.map((neuron) => neuron.id)).toEqual(
      ['alpha', 'zeta'].map((id) => `${NEURON_ID_PREFIX}${id}`)
    )
  })

  it('puts a freshly created neuron at the front', async () => {
    const database = useDatabase('order-fresh')
    await seed('order-fresh', [['existing', '2026-01-01T00:00:00.000Z']])
    const created = await database.create(
      StringNeuron.create({ value: 'brand new', parentId: 'p1' })
    )

    const children = await database.listByParentId('p1')

    expect(children[0]?.id).toBe(created.id)
  })
})

describe('Neuron id prefix', () => {
  it('selects neurons by key range, ignoring anything stored alongside them', async () => {
    // The prefix is the index: a foreign document in the same database is not
    // in the range, so it never reaches the neuron factory.
    const database = useDatabase('prefix-range')
    const neuron = await database.create(StringNeuron.create({ name: 'a real neuron' }))
    const client = new PouchDB<Record<string, unknown>>('prefix-range', { adapter: 'memory' })
    await client.put({ _id: 'config:app', kind: 'not a neuron' })
    await client.put({ _id: 'zzz-after-the-range', kind: 'also not a neuron' })

    const all = await database.list()

    expect(all.map((found) => found.id)).toEqual([neuron.id])
  })

  it('ignores a foreign document on the change feed', async () => {
    const database = useDatabase('prefix-watch')
    const seen: string[] = []
    const stop = await database.watch({ change: (change) => seen.push(change.id) })

    const client = new PouchDB<Record<string, unknown>>('prefix-watch', { adapter: 'memory' })
    await client.put({ _id: 'config:app', kind: 'not a neuron' })
    const neuron = await database.create(StringNeuron.create({ name: 'watched' }))

    const deadline = Date.now() + 3000
    while (!seen.includes(neuron.id) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20))
    }

    expect(seen).toEqual([neuron.id])
    stop()
  })
})

describe('Database.update', () => {
  it('writes the change back and moves the revision on', async () => {
    const database = useDatabase('update-write')
    const neuron = await database.create(StringNeuron.create({ name: 'before' }))
    const revisionBefore = neuron.revision
    const updatedAtBefore = neuron.updatedAt ?? ''
    // Timestamps have millisecond resolution, so give the clock room to move
    // rather than asserting on two writes that can land in the same tick.
    await new Promise((resolve) => setTimeout(resolve, 5))

    neuron.value = 'edited content'
    await database.update(neuron)

    expect(neuron.revision).not.toBe(revisionBefore)
    expect((neuron.updatedAt ?? '') > updatedAtBefore).toBe(true)
    const stored = await readStoredDocument('update-write', neuron.id)
    expect(stored.value).toBe('edited content')
  })

  it('leaves created_at alone', async () => {
    const database = useDatabase('update-created')
    const neuron = await database.create(StringNeuron.create({ name: 'keeps its birthday' }))
    const createdAt = neuron.createdAt

    neuron.value = 'changed'
    await database.update(neuron)

    expect(neuron.createdAt).toBe(createdAt)
  })

  it('refuses a neuron that was never saved', async () => {
    const database = useDatabase('update-unsaved')
    const neuron = StringNeuron.create({ name: 'never written' })

    await expect(database.update(neuron)).rejects.toThrow(NeuronError)
  })

  it('fails loudly on a stale revision rather than forking the document', async () => {
    const database = useDatabase('update-stale')
    const neuron = await database.create(StringNeuron.create({ name: 'contested' }))
    // A second reader edits first, leaving the first holder's revision behind.
    const other = await database.get(neuron.id)
    if (other === null) throw new Error('setup failed')
    other.name = 'won the race'
    await database.update(other)

    neuron.name = 'lost the race'
    await expect(database.update(neuron)).rejects.toThrow(/conflict \(409\)/)
  })
})

describe('Database.rename', () => {
  it('changes the name and persists it', async () => {
    const database = useDatabase('rename-basic')
    const neuron = await database.create(StringNeuron.create({ name: 'old name' }))

    await database.rename(neuron, 'new name')

    expect(neuron.name).toBe('new name')
    const stored = await readStoredDocument('rename-basic', neuron.id)
    expect(stored.name).toBe('new name')
  })

  it('trims surrounding whitespace', async () => {
    const database = useDatabase('rename-trim')
    const neuron = await database.create(StringNeuron.create({ name: 'old' }))

    await database.rename(neuron, '   padded   ')

    expect(neuron.name).toBe('padded')
  })

  it('treats an empty name as no name', async () => {
    const database = useDatabase('rename-empty')
    const neuron = await database.create(StringNeuron.create({ name: 'had one' }))

    await database.rename(neuron, '   ')

    expect(neuron.name).toBeNull()
    const stored = await readStoredDocument('rename-empty', neuron.id)
    expect(stored.name).toBeNull()
  })

  it('leaves the value untouched', async () => {
    const database = useDatabase('rename-value')
    const neuron = await database.create(
      StringNeuron.create({ name: 'a name', value: 'some content' })
    )

    await database.rename(neuron, 'a different name')

    const reloaded = await database.get(neuron.id)
    expect(reloaded instanceof StringNeuron ? reloaded.value : null).toBe('some content')
  })

  it('does not resurrect a deleted neuron', async () => {
    const database = useDatabase('rename-deleted')
    const neuron = await database.create(StringNeuron.create({ name: 'gone' }))
    await database.delete(neuron)

    await database.rename(neuron, 'renamed while deleted')

    // Renaming writes the neuron as it stands, deleted_at included.
    await expect(database.get(neuron.id)).resolves.toBeNull()
  })
})
