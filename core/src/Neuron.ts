export interface NeuronDocument {
  _id: string
  _rev?: string
  type: string
  parent_id: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  deleted_at: string | null
}

export abstract class Neuron {
  id: string
  revision: string | null
  parentId: string | null
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  deletedAt: string | null

  protected constructor() {
    this.id = crypto.randomUUID()
    this.revision = null
    this.parentId = null
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
      parent_id: this.parentId,
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
    this.parentId = document.parent_id
    this.createdAt = document.created_at
    this.updatedAt = document.updated_at
    this.createdBy = document.created_by
    // Documents written before soft delete existed have no deleted_at at all.
    this.deletedAt = document.deleted_at ?? null
  }
}
