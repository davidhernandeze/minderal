import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { BooleanNeuron, ConnectionFactory, NeuronError, StringNeuron } from '../src/index.js'
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

describe('Database.setAttribute', () => {
  it('records the name on the owner and the value in its own neuron', async () => {
    const database = useDatabase('attr-set')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    const birthday = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    expect(david.attributes).toEqual([{ name: 'birthday', id: birthday.id }])
    expect(birthday.attributeOf).toBe(david.id)
    expect(birthday.parentId).toBeNull()
  })

  it('gives the value its own lifecycle metadata', async () => {
    // The whole point of pointing at a neuron rather than inlining the value.
    const database = useDatabase('attr-metadata')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    const birthday = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    expect(birthday.createdBy).toBe('local')
    expect(birthday.createdAt).not.toBeNull()
    expect(birthday.revision).toMatch(/^1-/)
  })

  it('replaces an existing attribute of the same name, keeping one value', async () => {
    const database = useDatabase('attr-replace')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const first = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: 'wrong' })
    )

    const second = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: 'right' })
    )

    expect(david.attributes).toHaveLength(1)
    expect(david.attributes[0]?.id).toBe(second.id)
    // The superseded value is soft deleted rather than orphaned.
    await expect(database.get(first.id, { includeAttributes: true })).resolves.toBeNull()
  })

  it('keeps several differently named attributes', async () => {
    const database = useDatabase('attr-many')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))
    await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Madrid' }))

    expect(david.attributes.map((attribute) => attribute.name).sort()).toEqual([
      'birthday',
      'city'
    ])
  })

  it('refuses an unnamed attribute', async () => {
    const database = useDatabase('attr-unnamed')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    await expect(
      database.setAttribute(david, '   ', StringNeuron.create({ value: 'x' }))
    ).rejects.toThrow(NeuronError)
  })

  it('refuses an owner that was never saved', async () => {
    const database = useDatabase('attr-unsaved')
    const david = StringNeuron.create({ name: 'David' })

    await expect(
      database.setAttribute(david, 'birthday', StringNeuron.create({ value: 'x' }))
    ).rejects.toThrow(NeuronError)
  })
})

describe('Attribute values stay out of the listings', () => {
  it('does not appear at the top level, where its null parent_id would put it', async () => {
    const database = useDatabase('attr-hidden-root')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))

    const roots = await database.listByParentId(null)

    expect(roots.map((neuron) => neuron.id)).toEqual([david.id])
  })

  it('does not appear in list() either', async () => {
    const database = useDatabase('attr-hidden-list')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))

    expect(await database.list()).toHaveLength(1)
    expect(await database.list({ includeAttributes: true })).toHaveLength(2)
  })

  it('is not confused with a real child', async () => {
    const database = useDatabase('attr-vs-child')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const project = await database.create(
      StringNeuron.create({ name: 'Projects', parentId: david.id })
    )
    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))

    const children = await database.listByParentId(david.id)

    expect(children.map((neuron) => neuron.id)).toEqual([project.id])
  })
})

describe('Database.getAttribute and listAttributes', () => {
  it('resolves an attribute by name', async () => {
    const database = useDatabase('attr-get')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const birthday = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    const found = await database.getAttribute(david, 'birthday')

    expect(found?.id).toBe(birthday.id)
    expect(found instanceof StringNeuron ? found.value : null).toBe('1994-03-12')
  })

  it('returns null for a name the owner does not have', async () => {
    const database = useDatabase('attr-get-missing')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    await expect(database.getAttribute(david, 'nothing')).resolves.toBeNull()
  })

  it('resolves them all in one read, in the order the owner lists them', async () => {
    const database = useDatabase('attr-list')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))
    await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Madrid' }))

    const resolved = await database.listAttributes(david)

    expect(resolved.map((entry) => entry.name)).toEqual(['birthday', 'city'])
    expect(
      resolved.map((entry) => (entry.neuron instanceof StringNeuron ? entry.neuron.value : null))
    ).toEqual(['1994-03-12', 'Madrid'])
  })

  it('skips an entry whose neuron has gone', async () => {
    // A dangling id should thin the list, not throw.
    const database = useDatabase('attr-dangling')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'birthday', StringNeuron.create({ value: '1994-03-12' }))
    david.attributes = [...david.attributes, { name: 'ghost', id: 'neuron:not-there' }]

    const resolved = await database.listAttributes(david)

    expect(resolved.map((entry) => entry.name)).toEqual(['birthday'])
  })
})

describe('Database.removeAttribute', () => {
  it('drops the entry and soft deletes the value', async () => {
    const database = useDatabase('attr-remove')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const birthday = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    await expect(database.removeAttribute(david, 'birthday')).resolves.toBe(true)

    expect(david.attributes).toEqual([])
    await expect(database.get(birthday.id, { includeAttributes: true })).resolves.toBeNull()
  })

  it('reports when there was nothing to remove', async () => {
    const database = useDatabase('attr-remove-missing')
    const david = await database.create(StringNeuron.create({ name: 'David' }))

    await expect(database.removeAttribute(david, 'nothing')).resolves.toBe(false)
  })
})

describe('Deleting an owner', () => {
  it('takes its attribute values with it', async () => {
    // They have no parent_id, so the parent walk alone would leave them behind.
    const database = useDatabase('attr-cascade')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const birthday = await database.setAttribute(
      david,
      'birthday',
      StringNeuron.create({ value: '1994-03-12' })
    )

    await database.delete(david)

    await expect(database.get(birthday.id, { includeAttributes: true })).resolves.toBeNull()
  })

  it('takes the attributes of a descendant too', async () => {
    const database = useDatabase('attr-cascade-deep')
    const root = await database.create(StringNeuron.create({ name: 'root' }))
    const child = await database.create(
      StringNeuron.create({ name: 'child', parentId: root.id })
    )
    const childAttribute = await database.setAttribute(
      child,
      'colour',
      StringNeuron.create({ value: 'blue' })
    )

    await database.delete(root)

    await expect(
      database.get(childAttribute.id, { includeAttributes: true })
    ).resolves.toBeNull()
  })
})

describe('Database.renameAttribute', () => {
  it('moves the entry without touching the neuron that holds the value', async () => {
    const database = useDatabase('attr-rename-keeps')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    const value = await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Madrid' }))

    expect(await database.renameAttribute(david, 'city', 'town')).toBe(true)

    const attributes = await database.listAttributes(david)
    expect(attributes.map((attribute) => attribute.name)).toEqual(['town'])
    // The same document, so whatever type it was it still is.
    expect(attributes[0]?.neuron.id).toBe(value.id)
    expect(await database.get(value.id)).not.toBeNull()
  })

  it('keeps the value readable as its own type', async () => {
    const database = useDatabase('attr-rename-type')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'alive', BooleanNeuron.create({ value: true }))

    await database.renameAttribute(david, 'alive', 'breathing')

    const [attribute] = await database.listAttributes(david)
    expect(attribute?.neuron).toBeInstanceOf(BooleanNeuron)
    expect(attribute?.name).toBe('breathing')
  })

  it('refuses a name another attribute already uses', async () => {
    const database = useDatabase('attr-rename-clash')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Madrid' }))
    await database.setAttribute(david, 'town', StringNeuron.create({ value: 'Leon' }))

    await expect(database.renameAttribute(david, 'city', 'town')).rejects.toThrow(NeuronError)
    // Nothing moved, so both are still reachable under their own names.
    const attributes = await database.listAttributes(david)
    expect(attributes.map((attribute) => attribute.name).sort()).toEqual(['city', 'town'])
  })

  it('refuses an empty name and reports an attribute that is not there', async () => {
    const database = useDatabase('attr-rename-guards')
    const david = await database.create(StringNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Madrid' }))

    await expect(database.renameAttribute(david, 'city', '  ')).rejects.toThrow(NeuronError)
    expect(await database.renameAttribute(david, 'missing', 'town')).toBe(false)
  })
})
