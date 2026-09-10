import { describe, expect, it } from 'vitest'
import { STRING_NEURON_TYPE, StringNeuron } from '../src/index.js'
import type { StringNeuronDocument } from '../src/index.js'

describe('StringNeuron.create', () => {
  it('assigns an id and leaves the saved-only fields empty', () => {
    const neuron = StringNeuron.create({ value: 'hello' })

    expect(neuron.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(neuron.value).toBe('hello')
    expect(neuron.name).toBeNull()
    expect(neuron.type).toBe(STRING_NEURON_TYPE)
    // Nothing below is known until a Database writes the neuron.
    expect(neuron.revision).toBeNull()
    expect(neuron.createdAt).toBeNull()
    expect(neuron.updatedAt).toBeNull()
    expect(neuron.createdBy).toBeNull()
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
      created_at: '2026-09-09T10:00:00.000Z',
      updated_at: '2026-09-09T11:00:00.000Z',
      created_by: 'david'
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
    _id: 'neuron-1',
    _rev: '2-def',
    type: 'string',
    value: 'stored',
    name: 'Stored name',
    parent_id: 'parent-1',
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T11:00:00.000Z',
    created_by: 'david'
  }

  it('fills the object from a document', () => {
    const neuron = StringNeuron.fromDocument(storedDocument)

    expect(neuron.id).toBe('neuron-1')
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

  it('reads a document with no _rev as an unsaved neuron', () => {
    const { _rev, ...withoutRevision } = storedDocument

    expect(StringNeuron.fromDocument(withoutRevision).revision).toBeNull()
  })
})
