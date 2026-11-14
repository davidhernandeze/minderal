#!/usr/bin/env node
// Fills a database with a small, coherent example that exercises what the
// library can do: types with defaults, documents made from them, nesting, and
// attributes of every representation there is.
//
//   node scripts/seed-demo.mjs
//
// It converges rather than duplicating: a type or a neuron that is already
// there by name is reused, so running it twice leaves the same database.
import {
  BOOLEAN_NEURON_TYPE,
  ConnectionFactory,
  NEURON_ROOT_ID,
  OBJECT_NEURON_TYPE,
  ObjectNeuron,
  STRING_NEURON_TYPE,
  StringNeuron,
  Template
} from '../core/dist/index.js'

const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'
const databaseName = process.env.MINDERAL_DATABASE ?? 'neurons'

const text = (value) => StringNeuron.create({ value })

function line(depth, mark, what) {
  console.log(`${'  '.repeat(depth)}${mark} ${what}`)
}

// Types ---------------------------------------------------------------------

async function ensureTemplate(database, name, attributes, extended = null) {
  const all = await database.listTemplates()
  const existing = all.find((template) => template.name === name)
  const template = existing ?? (await database.createTemplate(Template.create({ name })))
  const extends_ = extended === null ? '' : ` extends ${extended.name}`
  line(1, existing === undefined ? '+' : '=', `type ${name}${extends_}`)

  if (extended !== null && template.extendsId !== extended.id) {
    await database.setTemplateExtends(template, extended.id)
  }

  for (const attribute of attributes) {
    const already = template.attributes.find((entry) => entry.name === attribute.name)
    if (already !== undefined) continue
    await database.setTemplateAttribute(template, attribute)
    // An attribute of a user-defined type reads as that type's name, which is
    // what the picker and the sidebar show.
    const shape =
      attribute.templateId === null
        ? attribute.type
        : (all.find((entry) => entry.id === attribute.templateId)?.name ?? attribute.type)
    line(2, '+', `${attribute.name} : ${shape}`)
  }

  return template
}

function stringAttribute(name, defaultValue = null) {
  return { name, type: STRING_NEURON_TYPE, templateId: null, defaultValue }
}

function booleanAttribute(name, defaultValue) {
  return { name, type: BOOLEAN_NEURON_TYPE, templateId: null, defaultValue }
}

function typedAttribute(name, template) {
  return { name, type: OBJECT_NEURON_TYPE, templateId: template.id, defaultValue: null }
}

// Neurons -------------------------------------------------------------------

async function childNamed(database, parentId, name) {
  const children = await database.listByParentId(parentId)
  return children.find((neuron) => neuron.name === name) ?? null
}

async function ensureFolder(database, parentId, name, depth) {
  const existing = await childNamed(database, parentId, name)
  if (existing !== null) {
    line(depth, '=', name)
    return existing
  }
  const folder = await database.create(ObjectNeuron.create({ name, parentId }))
  line(depth, '+', name)
  return folder
}

async function ensureOfType(database, parentId, template, name, depth) {
  const existing = await childNamed(database, parentId, name)
  if (existing !== null) {
    line(depth, '=', `${name} (${template.name})`)
    return existing
  }
  const made = await database.createFromTemplate(template, { name, parentId })
  line(depth, '+', `${name} (${template.name})`)
  return made
}

// Writes the value only when it is not already that value — which covers both
// an attribute the type never mentioned and one the type created empty, and
// leaves a second run with nothing to do.
async function ensureText(database, owner, name, value) {
  const entry = owner.attributes.find((attribute) => attribute.name === name)
  if (entry !== undefined) {
    const current = await database.get(entry.id)
    if (current instanceof StringNeuron && current.value === value) return
  }
  await database.setAttribute(owner, name, text(value))
}

// The value a type brought in is a neuron of its own, so it can be filled in
// further — this is what the graph draws under the attribute's own name.
async function fillIn(database, owner, attributeName, values, name = null) {
  const attribute = owner.attributes.find((entry) => entry.name === attributeName)
  if (attribute === undefined) return null
  const neuron = await database.get(attribute.id)
  if (neuron === null) return null
  for (const [field, value] of Object.entries(values)) {
    await ensureText(database, neuron, field, value)
  }
  // A nameless object reads as a blank in the row that holds it, so give the
  // ones a person would recognise a name.
  if (name !== null && neuron.name === null) await database.rename(neuron, name)
  return neuron
}

async function main() {
  const connection = await ConnectionFactory.createRemoteConnection({
    url: couchUrl,
    username,
    password
  })

  try {
    const database = connection.getDatabase(databaseName)
    await database.getRoot()
    console.log(`Seeding "${databaseName}" at ${couchUrl}\n`)

    console.log('Types')
    const address = await ensureTemplate(database, 'address', [
      stringAttribute('street'),
      stringAttribute('city', 'Madrid'),
      stringAttribute('country', 'Spain')
    ])
    const person = await ensureTemplate(database, 'person', [
      stringAttribute('email'),
      booleanAttribute('active', true),
      typedAttribute('home', address)
    ])
    const project = await ensureTemplate(database, 'project', [
      stringAttribute('status', 'planned'),
      booleanAttribute('shipped', false),
      typedAttribute('lead', person)
    ])

    // A narrower kind: everything a person has, plus what only an uncle has.
    // Its documents are counted under person as well, which is the point.
    const uncle = await ensureTemplate(
      database,
      'uncle',
      [stringAttribute('nephews', '0')],
      person
    )

    console.log('\nTree')
    const people = await ensureFolder(database, NEURON_ROOT_ID, 'People', 1)
    const ada = await ensureOfType(database, people.id, person, 'Ada Lovelace', 2)
    const grace = await ensureOfType(database, people.id, person, 'Grace Hopper', 2)
    const pedro = await ensureOfType(database, people.id, uncle, 'Pedro', 2)

    await ensureText(database, ada, 'email', 'ada@example.com')
    await fillIn(database, ada, 'home', { street: '12 Analytical Way', city: 'London' }, 'London')
    await ensureText(database, grace, 'email', 'grace@example.com')
    await fillIn(
      database,
      grace,
      'home',
      { street: '1 Compiler Lane', city: 'New York' },
      'New York'
    )
    await ensureText(database, pedro, 'email', 'pedro@example.com')
    await ensureText(database, pedro, 'nephews', '2')
    await fillIn(database, pedro, 'home', { street: '8 Calle Mayor' }, 'Madrid')

    const projects = await ensureFolder(database, NEURON_ROOT_ID, 'Projects', 1)
    const minderal = await ensureOfType(database, projects.id, project, 'Minderal', 2)
    // Beyond what the type brings: a neuron takes attributes the type never
    // mentioned, because a type describes a start, not a limit.
    await ensureText(database, minderal, 'repository', 'minderal/core')
    // The type starts a project as "planned"; this one has moved on.
    await ensureText(database, minderal, 'status', 'building')
    await fillIn(database, minderal, 'lead', { email: 'ada@example.com' }, 'Ada Lovelace')

    const notes = await ensureFolder(database, NEURON_ROOT_ID, 'Notes', 1)
    for (const [name, body] of [
      ['Why a root', 'parent_id points at a parent, always. Null means unfiled.'],
      ['Why types', 'A type is a start, not a limit.']
    ]) {
      const existing = await childNamed(database, notes.id, name)
      if (existing !== null) {
        line(2, '=', name)
        continue
      }
      await database.create(StringNeuron.create({ name, value: body, parentId: notes.id }))
      line(2, '+', name)
    }

    console.log('\nCounts')
    for (const template of [address, person, uncle, project]) {
      const exact = await database.listByTemplateId(template.id)
      const withSubtypes = await database.listByTemplateId(template.id, { includeSubtypes: true })
      const wider =
        withSubtypes.length === exact.length ? '' : ` (${withSubtypes.length} with subtypes)`
      line(1, '·', `${template.name}: ${exact.length} document(s)${wider}`)
    }
    const top = await database.listByParentId(NEURON_ROOT_ID)
    line(1, '·', `top level: ${top.map((neuron) => neuron.name).join(', ')}`)

    console.log('\nDone. Open the app and switch between Neurons and Types.')
  } finally {
    await connection.close()
  }
}

await main()
