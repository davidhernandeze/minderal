import { describe, expect, it } from 'vitest'
import {
  BOOLEAN_NEURON_TYPE,
  BooleanNeuron,
  NEURON_ID_PREFIX,
  NeuronError,
  NeuronFactory,
  OBJECT_NEURON_TYPE,
  ObjectNeuron,
  STRING_NEURON_TYPE,
  StringNeuron
} from '../src/index.js'
import type { ObjectNeuronDocument, StringNeuronDocument } from '../src/index.js'

describe('StringNeuron.create', () => {
  it('assigns an id and leaves the saved-only fields empty', () => {
    const neuron = StringNeuron.create({ value: 'hello' })

    // Every neuron id carries the prefix a key range selects on.
    expect(neuron.id).toMatch(/^neuron:[0-9a-f-]{36}$/)
    expect(neuron.value).toBe('hello')
    expect(neuron.name).toBeNull()
    expect(neuron.type).toBe(STRING_NEURON_TYPE)
    // Nothing below is known until a Database writes the neuron.
    expect(neuron.revision).toBeNull()
    expect(neuron.createdAt).toBeNull()
    expect(neuron.updatedAt).toBeNull()
    expect(neuron.createdBy).toBeNull()
    expect(neuron.deletedAt).toBeNull()
  })

  it('gives every neuron its own id', () => {
    const first = StringNeuron.create({ value: 'a' })
    const second = StringNeuron.create({ value: 'a' })

    expect(first.id).not.toBe(second.id)
  })

  it('defaults parentId to null and keeps one when given', () => {
    expect(StringNeuron.create({ value: 'a' }).parentId).toBeNull()
    expect(StringNeuron.create({ value: 'a', parentId: 'parent-1' }).parentId).toBe('parent-1')
  })

  it('defaults name to null and keeps one when given', () => {
    expect(StringNeuron.create({ value: 'a' }).name).toBeNull()
    expect(StringNeuron.create({ value: 'a', name: 'Greeting' }).name).toBe('Greeting')
    // An explicit null is a name that was cleared, not a missing one.
    expect(StringNeuron.create({ value: 'a', name: null }).name).toBeNull()
  })
})

describe('StringNeuron.toDocument', () => {
  it('maps every field to its document name', () => {
    const neuron = StringNeuron.create({ value: 'hello', name: 'Greeting', parentId: 'parent-1' })
    neuron.createdAt = '2026-09-09T10:00:00.000Z'
    neuron.updatedAt = '2026-09-09T11:00:00.000Z'
    neuron.createdBy = 'david'

    expect(neuron.toDocument()).toEqual({
      _id: neuron.id,
      type: 'string',
      value: 'hello',
      name: 'Greeting',
      parent_id: 'parent-1',
      previous_parent_id: null,
      attributes: [],
      attribute_of: null,
      created_at: '2026-09-09T10:00:00.000Z',
      updated_at: '2026-09-09T11:00:00.000Z',
      created_by: 'david',
      deleted_at: null
    })
  })

  it('writes a null name rather than dropping the field', () => {
    expect(StringNeuron.create({ value: 'hello' }).toDocument().name).toBeNull()
  })

  it('omits _rev entirely on an unsaved neuron', () => {
    // CouchDB rejects a create that carries a _rev, even a null one.
    const document = StringNeuron.create({ value: 'hello' }).toDocument()

    expect('_rev' in document).toBe(false)
  })

  it('includes _rev once the neuron has a revision', () => {
    const neuron = StringNeuron.create({ value: 'hello' })
    neuron.revision = '1-abc'

    expect(neuron.toDocument()._rev).toBe('1-abc')
  })
})

describe('StringNeuron.parseDocument', () => {
  const storedDocument: StringNeuronDocument = {
    _id: `${NEURON_ID_PREFIX}neuron-1`,
    _rev: '2-def',
    type: 'string',
    value: 'stored',
    name: 'Stored name',
    parent_id: 'parent-1',
    previous_parent_id: null,
    attributes: [],
    attribute_of: null,
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T11:00:00.000Z',
    created_by: 'david',
    deleted_at: null
  }

  it('fills the object from a document', () => {
    const neuron = StringNeuron.fromDocument(storedDocument)

    expect(neuron.id).toBe(`${NEURON_ID_PREFIX}neuron-1`)
    expect(neuron.revision).toBe('2-def')
    expect(neuron.value).toBe('stored')
    expect(neuron.name).toBe('Stored name')
    expect(neuron.parentId).toBe('parent-1')
    expect(neuron.createdAt).toBe('2026-09-09T10:00:00.000Z')
    expect(neuron.updatedAt).toBe('2026-09-09T11:00:00.000Z')
    expect(neuron.createdBy).toBe('david')
  })

  it('round-trips a document unchanged', () => {
    expect(StringNeuron.fromDocument(storedDocument).toDocument()).toEqual(storedDocument)
  })

  it('reads a null name back as null', () => {
    const neuron = StringNeuron.fromDocument({ ...storedDocument, name: null })

    expect(neuron.name).toBeNull()
  })

  it('reads a document written before soft delete existed', () => {
    // deleted_at arrived later; older documents simply do not carry it.
    const { deleted_at, ...legacyDocument } = storedDocument

    expect(StringNeuron.fromDocument(legacyDocument as StringNeuronDocument).deletedAt).toBeNull()
  })

  it('reads a document with no _rev as an unsaved neuron', () => {
    const { _rev, ...withoutRevision } = storedDocument

    expect(StringNeuron.fromDocument(withoutRevision).revision).toBeNull()
  })
})

describe('BooleanNeuron', () => {
  it('defaults to false and keeps the value it is given', () => {
    expect(BooleanNeuron.create().value).toBe(false)
    expect(BooleanNeuron.create({ value: true }).value).toBe(true)
    expect(BooleanNeuron.create({ value: true }).type).toBe(BOOLEAN_NEURON_TYPE)
  })

  it('writes false as a value rather than dropping the field', () => {
    const document = BooleanNeuron.create({ value: false, name: 'Alive' }).toDocument()

    expect(document.value).toBe(false)
    expect(document.type).toBe(BOOLEAN_NEURON_TYPE)
  })

  it('round-trips a document unchanged', () => {
    const neuron = BooleanNeuron.create({ value: true, name: 'Alive', parentId: 'neuron:p' })
    neuron.createdAt = '2026-10-02T10:00:00.000Z'
    neuron.revision = '2-abc'

    expect(BooleanNeuron.fromDocument(neuron.toDocument()).toDocument()).toEqual(neuron.toDocument())
  })
})

describe('ObjectNeuron', () => {
  it('has no value of its own, only a name and its attributes', () => {
    const neuron = ObjectNeuron.create({ name: 'David' })

    expect(neuron.type).toBe(OBJECT_NEURON_TYPE)
    expect(neuron.name).toBe('David')
    expect(neuron.attributes).toEqual([])
    expect('value' in neuron).toBe(false)
  })

  it('defaults templateId to null and keeps one when given', () => {
    expect(ObjectNeuron.create().templateId).toBeNull()
    expect(ObjectNeuron.create({ templateId: 'template:person' }).templateId).toBe('template:person')
  })

  it('round-trips a document unchanged', () => {
    const neuron = ObjectNeuron.create({ name: 'David', templateId: 'template:person' })
    neuron.createdAt = '2026-10-02T10:00:00.000Z'

    expect(ObjectNeuron.fromDocument(neuron.toDocument()).toDocument()).toEqual(neuron.toDocument())
  })

  it('reads a document written without a template', () => {
    // A neuron that follows no template still has to be readable.
    const { template_id, ...withoutTemplate } = ObjectNeuron.create({ name: 'David' }).toDocument()

    expect(ObjectNeuron.fromDocument(withoutTemplate as ObjectNeuronDocument).templateId).toBeNull()
  })
})

describe('NeuronFactory.fromDocument', () => {
  it('reads each type back as its own class', () => {
    const text = NeuronFactory.fromDocument(StringNeuron.create({ value: 'hello' }).toDocument())
    const flag = NeuronFactory.fromDocument(BooleanNeuron.create({ value: true }).toDocument())
    const thing = NeuronFactory.fromDocument(ObjectNeuron.create({ name: 'David' }).toDocument())

    expect(text).toBeInstanceOf(StringNeuron)
    expect(flag).toBeInstanceOf(BooleanNeuron)
    expect(thing).toBeInstanceOf(ObjectNeuron)
  })

  // The type picks the class; the value's shape only has to agree with it. A
  // boolean sitting in a document that calls itself a string is not readable.
  it('refuses a document whose value does not match its type', () => {
    const { value, ...base } = StringNeuron.create({ value: 'hello' }).toDocument()
    const mismatched = { ...base, value: true }

    expect(() => NeuronFactory.fromDocument(mismatched)).toThrow(NeuronError)
  })

  it('refuses a type it has never heard of', () => {
    const document = { ...StringNeuron.create({ value: 'hello' }).toDocument(), type: 'colour' }

    expect(() => NeuronFactory.fromDocument(document)).toThrow(NeuronError)
  })
})
