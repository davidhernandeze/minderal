import { v4 as generateUuid } from 'uuid'

// Every neuron document id carries this prefix, so a key range over _all_docs
// selects exactly the neurons and nothing else.
export const NEURON_ID_PREFIX = 'neuron:'

export function generateNeuronId(): string {
  return `${NEURON_ID_PREFIX}${generateUuid()}`
}

export function isNeuronId(id: string): boolean {
  return id.startsWith(NEURON_ID_PREFIX)
}

// A 1-to-1 relation: the name lives on the owner, the value and all of its
// metadata live in the neuron the id points at.
export interface NeuronAttribute {
  name: string
  id: string
}

export interface NeuronDocument {
  _id: string
  _rev?: string
  type: string
  name: string | null
  parent_id: string | null
  previous_parent_id: string | null
  attributes: NeuronAttribute[]
  // Set on a neuron that exists to hold an attribute's value. Such a neuron has
  // no parent_id: it is reached through its owner's attributes array, and is
  // kept out of the listings so it never reads as a child.
  attribute_of: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  deleted_at: string | null
}

export abstract class Neuron {
  id: string
  revision: string | null
  name: string | null
  parentId: string | null
  previousParentId: string | null
  attributes: NeuronAttribute[]
  attributeOf: string | null
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  deletedAt: string | null

  protected constructor() {
    this.id = generateNeuronId()
    this.revision = null
    this.name = null
    this.parentId = null
    this.previousParentId = null
    this.attributes = []
    this.attributeOf = null
    this.createdAt = null
    this.updatedAt = null
    this.createdBy = null
    this.deletedAt = null
  }

  abstract readonly type: string

  abstract toDocument(): NeuronDocument

  abstract parseDocument(document: NeuronDocument): void

  protected toBaseDocument(): NeuronDocument {
    const document: NeuronDocument = {
      _id: this.id,
      type: this.type,
      name: this.name,
      parent_id: this.parentId,
      previous_parent_id: this.previousParentId,
      attributes: this.attributes,
      attribute_of: this.attributeOf,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      created_by: this.createdBy,
      deleted_at: this.deletedAt
    }
    if (this.revision !== null) document._rev = this.revision
    return document
  }

  protected parseBaseDocument(document: NeuronDocument): void {
    this.id = document._id
    this.revision = document._rev ?? null
    this.name = document.name
    this.parentId = document.parent_id
    this.previousParentId = document.previous_parent_id ?? null
    this.attributes = document.attributes ?? []
    this.attributeOf = document.attribute_of ?? null
    this.createdAt = document.created_at
    this.updatedAt = document.updated_at
    this.createdBy = document.created_by
    // Documents written before soft delete existed have no deleted_at at all.
    this.deletedAt = document.deleted_at ?? null
  }
}
