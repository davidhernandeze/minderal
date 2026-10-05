import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BOOLEAN_NEURON_TYPE,
  BooleanNeuron,
  ConnectionFactory,
  NeuronError,
  OBJECT_NEURON_TYPE,
  ObjectNeuron,
  STRING_NEURON_TYPE,
  StringNeuron,
  Template,
  isTemplateId
} from '../src/index.js'
import type { Database, Neuron } from '../src/index.js'

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

describe('Template', () => {
  it('takes an id under its own prefix', () => {
    const template = Template.create({ name: 'person' })

    expect(isTemplateId(template.id)).toBe(true)
    expect(template.id).toMatch(/^template:[0-9a-f-]{36}$/)
  })

  it('round-trips a document unchanged', () => {
    const template = Template.create({
      name: 'person',
      attributes: [
        { name: 'birthday', type: STRING_NEURON_TYPE, templateId: null,
        defaultValue: null },
        { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null,
        defaultValue: true }
      ]
    })
    template.createdAt = '2026-10-02T10:00:00.000Z'

    expect(Template.fromDocument(template.toDocument()).toDocument()).toEqual(template.toDocument())
  })

  it('keeps a default of false rather than losing it to the fallback', () => {
    const template = Template.create({
      attributes: [{ name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null,
        defaultValue: false }]
    })

    expect(Template.fromDocument(template.toDocument()).attributes[0]?.defaultValue).toBe(false)
  })
})

describe('Database templates', () => {
  it('stores and reads one back', async () => {
    const database = useDatabase('template-create')
    const created = await database.createTemplate(Template.create({ name: 'person' }))

    expect(created.revision).not.toBeNull()
    expect(created.createdBy).toBe('local')

    const read = await database.getTemplate(created.id)
    expect(read?.name).toBe('person')
  })

  // The two prefixes share a database but never each other's queries.
  it('keeps templates out of the neuron listings and neurons out of the template ones', async () => {
    const database = useDatabase('template-separate')
    await database.create(StringNeuron.create({ name: 'David' }))
    await database.createTemplate(Template.create({ name: 'person' }))

    expect((await database.list()).map((neuron) => neuron.name)).toEqual(['David'])
    expect((await database.listTemplates()).map((template) => template.name)).toEqual(['person'])
    expect(await database.getTemplate('neuron:nope')).toBeNull()
  })

  it('lists templates by name', async () => {
    const database = useDatabase('template-list')
    await database.createTemplate(Template.create({ name: 'person' }))
    await database.createTemplate(Template.create({ name: 'album' }))

    expect((await database.listTemplates()).map((template) => template.name)).toEqual([
      'album',
      'person'
    ])
  })

  it('hides a deleted template without destroying it', async () => {
    const database = useDatabase('template-delete')
    const template = await database.createTemplate(Template.create({ name: 'person' }))

    await database.deleteTemplate(template)

    expect(await database.listTemplates()).toEqual([])
    expect(await database.getTemplate(template.id)).toBeNull()
    expect((await database.getTemplate(template.id, { includeDeleted: true }))?.name).toBe('person')
  })

  it('refuses to update a template that was never saved', async () => {
    const database = useDatabase('template-unsaved')

    await expect(database.updateTemplate(Template.create({ name: 'person' }))).rejects.toThrow(
      NeuronError
    )
  })
})

describe('Database template attributes', () => {
  async function personTemplate(name: string): Promise<[Database, Template]> {
    const database = useDatabase(name)
    const template = await database.createTemplate(Template.create({ name: 'person' }))
    return [database, template]
  }

  it('adds an attribute with its type and default', async () => {
    const [database, template] = await personTemplate('template-attr-add')

    await database.setTemplateAttribute(template, {
      name: 'alive',
      type: BOOLEAN_NEURON_TYPE,
      templateId: null,
        defaultValue: true
    })

    const read = await database.getTemplate(template.id)
    expect(read?.attributes).toEqual([
      { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null,
        defaultValue: true }
    ])
  })

  it('replaces an attribute of the same name in place', async () => {
    const [database, template] = await personTemplate('template-attr-replace')

    await database.setTemplateAttribute(template, {
      name: 'alive',
      type: STRING_NEURON_TYPE,
      templateId: null,
        defaultValue: 'yes'
    })
    await database.setTemplateAttribute(template, {
      name: 'alive',
      type: BOOLEAN_NEURON_TYPE,
      templateId: null,
        defaultValue: false
    })

    const read = await database.getTemplate(template.id)
    expect(read?.attributes).toEqual([
      { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null,
        defaultValue: false }
    ])
  })

  it('renames an attribute and keeps its type and default', async () => {
    const [database, template] = await personTemplate('template-attr-rename')
    await database.setTemplateAttribute(template, {
      name: 'alive',
      type: BOOLEAN_NEURON_TYPE,
      templateId: null,
        defaultValue: true
    })

    expect(await database.renameTemplateAttribute(template, 'alive', 'breathing')).toBe(true)

    const read = await database.getTemplate(template.id)
    expect(read?.attributes).toEqual([
      { name: 'breathing', type: BOOLEAN_NEURON_TYPE, templateId: null,
        defaultValue: true }
    ])
  })

  it('refuses a name another attribute already uses, and an empty one', async () => {
    const [database, template] = await personTemplate('template-attr-guards')
    await database.setTemplateAttribute(template, {
      name: 'city',
      type: STRING_NEURON_TYPE,
      templateId: null,
        defaultValue: null
    })
    await database.setTemplateAttribute(template, {
      name: 'town',
      type: STRING_NEURON_TYPE,
      templateId: null,
        defaultValue: null
    })

    await expect(database.renameTemplateAttribute(template, 'city', 'town')).rejects.toThrow(
      NeuronError
    )
    await expect(
      database.setTemplateAttribute(template, {
        name: '  ',
        type: STRING_NEURON_TYPE,
        templateId: null,
        defaultValue: null
      })
    ).rejects.toThrow(NeuronError)
    expect(await database.renameTemplateAttribute(template, 'missing', 'other')).toBe(false)
  })

  it('removes an attribute and reports one that was not there', async () => {
    const [database, template] = await personTemplate('template-attr-remove')
    await database.setTemplateAttribute(template, {
      name: 'city',
      type: STRING_NEURON_TYPE,
      templateId: null,
        defaultValue: null
    })

    expect(await database.removeTemplateAttribute(template, 'city')).toBe(true)
    expect(await database.removeTemplateAttribute(template, 'city')).toBe(false)
    expect((await database.getTemplate(template.id))?.attributes).toEqual([])
  })
})

describe('Database.createFromTemplate', () => {
  it('makes a neuron that follows the type, filled with its defaults', async () => {
    const database = useDatabase('template-instantiate')
    const person = await database.createTemplate(
      Template.create({
        name: 'person',
        attributes: [
          { name: 'birthday', type: STRING_NEURON_TYPE, templateId: null, defaultValue: '1900-01-01' },
          { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null, defaultValue: true }
        ]
      })
    )

    const david = await database.createFromTemplate(person, { name: 'David' })

    expect(david).toBeInstanceOf(ObjectNeuron)
    expect(david.templateId).toBe(person.id)

    const attributes = await database.listAttributes(david)
    expect(attributes.map((attribute) => attribute.name).sort()).toEqual(['alive', 'birthday'])
    const birthday = attributes.find((attribute) => attribute.name === 'birthday')
    const alive = attributes.find((attribute) => attribute.name === 'alive')
    expect(birthday?.neuron).toBeInstanceOf(StringNeuron)
    expect(alive?.neuron).toBeInstanceOf(BooleanNeuron)
    expect(valueOf(alive?.neuron)).toBe(true)
    expect(valueOf(birthday?.neuron)).toBe('1900-01-01')
  })

  it('fills a nested type too', async () => {
    const database = useDatabase('template-nested')
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
          { name: 'home', type: OBJECT_NEURON_TYPE, templateId: address.id, defaultValue: null }
        ]
      })
    )

    const david = await database.createFromTemplate(person, { name: 'David' })

    const [home] = await database.listAttributes(david)
    expect(home?.neuron).toBeInstanceOf(ObjectNeuron)

    const inside = home === undefined ? [] : await database.listAttributes(home.neuron)
    expect(inside.map((attribute) => attribute.name)).toEqual(['city'])
    expect(valueOf(inside[0]?.neuron)).toBe('Madrid')
  })

  // Two types that hold each other would otherwise fill forever.
  it('stops when a type reaches itself', async () => {
    const database = useDatabase('template-cycle')
    const node = await database.createTemplate(Template.create({ name: 'node' }))
    await database.setTemplateAttribute(node, {
      name: 'next',
      type: OBJECT_NEURON_TYPE,
      templateId: node.id,
      defaultValue: null
    })

    const first = await database.createFromTemplate(node, { name: 'first' })

    const [next] = await database.listAttributes(first)
    expect(next?.name).toBe('next')
    // One level deep, and then it stops rather than going round again.
    const inside = next === undefined ? [] : await database.listAttributes(next.neuron)
    expect(inside).toEqual([])
  })

  it('leaves attributes that are already there alone', async () => {
    const database = useDatabase('template-apply-existing')
    const person = await database.createTemplate(
      Template.create({
        name: 'person',
        attributes: [
          { name: 'city', type: STRING_NEURON_TYPE, templateId: null, defaultValue: 'Madrid' }
        ]
      })
    )
    const david = await database.create(ObjectNeuron.create({ name: 'David' }))
    await database.setAttribute(david, 'city', StringNeuron.create({ value: 'Leon' }))

    await database.applyTemplate(david, person)

    const attributes = await database.listAttributes(david)
    expect(attributes).toHaveLength(1)
    expect(valueOf(attributes[0]?.neuron)).toBe('Leon')
  })

  it('skips a type it cannot read rather than guessing', async () => {
    const database = useDatabase('template-unknown-type')
    const odd = await database.createTemplate(
      Template.create({
        name: 'odd',
        attributes: [{ name: 'colour', type: 'colour', templateId: null, defaultValue: null }]
      })
    )

    const made = await database.createFromTemplate(odd, { name: 'one' })

    expect(await database.listAttributes(made)).toEqual([])
  })
})

// The value of whichever kind of neuron this is, for comparing in a test.
function valueOf(neuron: Neuron | undefined): string | boolean | null {
  if (neuron instanceof StringNeuron) return neuron.value
  if (neuron instanceof BooleanNeuron) return neuron.value
  return null
}

describe('Database.listByTemplateId', () => {
  async function personTemplate(name: string): Promise<[Database, Template]> {
    const database = useDatabase(name)
    const person = await database.createTemplate(
      Template.create({
        name: 'person',
        attributes: [
          { name: 'city', type: STRING_NEURON_TYPE, templateId: null, defaultValue: 'Madrid' }
        ]
      })
    )
    return [database, person]
  }

  it('finds every neuron made from the type', async () => {
    const [database, person] = await personTemplate('template-instances')
    await database.createFromTemplate(person, { name: 'David' })
    await database.createFromTemplate(person, { name: 'Ana' })
    // A neuron of another kind is not one of them.
    await database.create(ObjectNeuron.create({ name: 'something else' }))

    const made = await database.listByTemplateId(person.id)

    expect(made.map((neuron) => neuron.name).sort()).toEqual(['Ana', 'David'])
  })

  // An attribute value is a document of its type too, and it is the only kind
  // that every other listing deliberately hides.
  it('counts one held as an attribute', async () => {
    const [database, address] = await personTemplate('template-instances-attribute')
    const owner = await database.create(ObjectNeuron.create({ name: 'David' }))
    const home = await database.setAttribute(
      owner,
      'home',
      ObjectNeuron.create({ name: 'Home', templateId: address.id })
    )

    expect((await database.listByTemplateId(address.id)).map((n) => n.id)).toEqual([home.id])
  })

  it('leaves out a deleted one unless asked', async () => {
    const [database, person] = await personTemplate('template-instances-deleted')
    const david = await database.createFromTemplate(person, { name: 'David' })
    await database.delete(david)

    expect(await database.listByTemplateId(person.id)).toEqual([])
    expect(
      (await database.listByTemplateId(person.id, { includeDeleted: true })).map((n) => n.name)
    ).toEqual(['David'])
  })

  it('is empty for a type nothing was made from', async () => {
    const [database, person] = await personTemplate('template-instances-empty')

    expect(await database.listByTemplateId(person.id)).toEqual([])
  })
})

describe('Templates that extend another', () => {
  async function family(name: string) {
    const database = useDatabase(name)
    const being = await database.createTemplate(
      Template.create({
        name: 'being',
        attributes: [
          { name: 'alive', type: BOOLEAN_NEURON_TYPE, templateId: null, defaultValue: true }
        ]
      })
    )
    const person = await database.createTemplate(
      Template.create({
        name: 'person',
        extendsId: being.id,
        attributes: [
          { name: 'email', type: STRING_NEURON_TYPE, templateId: null, defaultValue: null }
        ]
      })
    )
    const uncle = await database.createTemplate(
      Template.create({
        name: 'uncle',
        extendsId: person.id,
        attributes: [
          { name: 'nephews', type: STRING_NEURON_TYPE, templateId: null, defaultValue: '0' }
        ]
      })
    )
    return { database, being, person, uncle }
  }

  it('resolves the whole chain, not just the parent', async () => {
    const { database, being, person, uncle } = await family('extends-chain')

    const resolved = await database.resolveTemplateAttributes(uncle)

    expect(resolved.map((entry) => entry.attribute.name)).toEqual(['alive', 'email', 'nephews'])
    expect(resolved.map((entry) => entry.definedBy)).toEqual([being.id, person.id, uncle.id])
    expect(resolved.map((entry) => entry.inherited)).toEqual([true, true, false])
  })

  // The nearest definition wins, and keeps the position the ancestor gave it so
  // the shape still reads the same way.
  it('lets a subtype narrow an attribute its ancestor defined', async () => {
    const { database, being, uncle } = await family('extends-override')
    await database.setTemplateAttribute(uncle, {
      name: 'alive',
      type: BOOLEAN_NEURON_TYPE,
      templateId: null,
      defaultValue: false
    })

    const resolved = await database.resolveTemplateAttributes(uncle)

    expect(resolved.map((entry) => entry.attribute.name)).toEqual(['alive', 'email', 'nephews'])
    expect(resolved[0]?.attribute.defaultValue).toBe(false)
    expect(resolved[0]?.inherited).toBe(false)
    // The type it came from is untouched: inherited means read, never copied.
    expect((await database.resolveTemplateAttributes(being))[0]?.attribute.defaultValue).toBe(true)
  })

  it('builds a neuron from everything the chain defines', async () => {
    const { database, uncle } = await family('extends-create')

    const pedro = await database.createFromTemplate(uncle, { name: 'Pedro' })

    const attributes = await database.listAttributes(pedro)
    expect(attributes.map((attribute) => attribute.name).sort()).toEqual([
      'alive',
      'email',
      'nephews'
    ])
    expect(pedro.templateId).toBe(uncle.id)
  })

  it('counts a subtype under the type it extends, however deep', async () => {
    const { database, being, person, uncle } = await family('extends-query')
    await database.createFromTemplate(uncle, { name: 'Pedro' })
    await database.createFromTemplate(person, { name: 'Ada' })

    // Exact by default: an uncle was made as an uncle, not as a person.
    expect((await database.listByTemplateId(person.id)).map((n) => n.name)).toEqual(['Ada'])
    expect(
      (await database.listByTemplateId(person.id, { includeSubtypes: true }))
        .map((n) => n.name)
        .sort()
    ).toEqual(['Ada', 'Pedro'])
    expect(
      (await database.listByTemplateId(being.id, { includeSubtypes: true }))
        .map((n) => n.name)
        .sort()
    ).toEqual(['Ada', 'Pedro'])
  })

  it('refuses the changes that would make a chain with no end', async () => {
    const { database, being, person, uncle } = await family('extends-cycles')

    await expect(database.setTemplateExtends(being, being.id)).rejects.toThrow(NeuronError)
    // being is already an ancestor of uncle, so it cannot also extend it.
    await expect(database.setTemplateExtends(being, uncle.id)).rejects.toThrow(NeuronError)
    await expect(database.setTemplateExtends(being, 'template:nope')).rejects.toThrow(NeuronError)
    expect((await database.getTemplate(being.id))?.extendsId).toBeNull()
    expect((await database.getTemplate(person.id))?.extendsId).toBe(being.id)
  })

  it('stops resolving a chain that was already broken into a loop', async () => {
    const { database, being, uncle } = await family('extends-broken-loop')
    // Written straight past the guard, the way replication could deliver it.
    being.extendsId = uncle.id
    await database.updateTemplate(being)

    const resolved = await database.resolveTemplateAttributes(uncle)

    expect(resolved.map((entry) => entry.attribute.name).sort()).toEqual([
      'alive',
      'email',
      'nephews'
    ])
  })

  it('clears what it extends', async () => {
    const { database, uncle } = await family('extends-clear')

    await database.setTemplateExtends(uncle, null)

    expect((await database.resolveTemplateAttributes(uncle)).map((e) => e.attribute.name)).toEqual([
      'nephews'
    ])
  })
})
