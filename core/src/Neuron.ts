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

export interface NeuronDocument {
  _id: string
  _rev?: string
  type: string
  name: string | null
  parent_id: string | null
  previous_parent_id: string | null
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
    this.createdAt = document.created_at
    this.updatedAt = document.updated_at
    this.createdBy = document.created_by
    // Documents written before soft delete existed have no deleted_at at all.
    this.deletedAt = document.deleted_at ?? null
  }
}
