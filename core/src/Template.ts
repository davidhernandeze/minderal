import { v4 as generateUuid } from 'uuid'
import type { NeuronDocument } from './Neuron.js'

// Templates live beside neurons under their own prefix, so the key range that
// selects neurons never reaches them and no listing has to filter them out.
export const TEMPLATE_ID_PREFIX = 'template:'
export const TEMPLATE_TYPE = 'template'

export function generateTemplateId(): string {
  return `${TEMPLATE_ID_PREFIX}${generateUuid()}`
}

export function isTemplateId(id: string): boolean {
  return id.startsWith(TEMPLATE_ID_PREFIX)
}

// What a neuron made from this template starts with. A literal rather than a
// neuron: nothing exists to point at until something is created.
export type TemplateDefault = string | boolean | null

// `type` is the representation and `templateId` the shape, never one field
// doing both: an attribute of a user-defined type is an object that names the
// template it follows.
export interface TemplateAttribute {
  name: string
  type: string
  templateId: string | null
  defaultValue: TemplateDefault
}

export interface TemplateAttributeDocument {
  name: string
  type: string
  template_id: string | null
  default_value: TemplateDefault
}

// A template rides on the neuron document shape so that one typed PouchDB
// handle carries both kinds. The relation fields it inherits are never used: a
// template is reached by its id, not through the tree, and NeuronFactory would
// refuse to read one as a neuron.
export interface TemplateDocument extends NeuronDocument {
  template_attributes: TemplateAttributeDocument[]
}

export interface TemplateProperties {
  name?: string | null
  attributes?: TemplateAttribute[]
}

export class Template {
  id: string
  revision: string | null
  name: string | null
  attributes: TemplateAttribute[]
  createdAt: string | null
  updatedAt: string | null
  createdBy: string | null
  deletedAt: string | null

  private constructor() {
    this.id = generateTemplateId()
    this.revision = null
    this.name = null
    this.attributes = []
    this.createdAt = null
    this.updatedAt = null
    this.createdBy = null
    this.deletedAt = null
  }

  static create(properties: TemplateProperties = {}): Template {
    const template = new Template()
    template.name = properties.name ?? null
    template.attributes = properties.attributes ?? []
    return template
  }

  static fromDocument(document: TemplateDocument): Template {
    const template = new Template()
    template.parseDocument(document)
    return template
  }

  toDocument(): TemplateDocument {
    const document: TemplateDocument = {
      _id: this.id,
      type: TEMPLATE_TYPE,
      name: this.name,
      parent_id: null,
      previous_parent_id: null,
      attributes: [],
      attribute_of: null,
      template_attributes: this.attributes.map((attribute) => ({
        name: attribute.name,
        type: attribute.type,
        template_id: attribute.templateId,
        default_value: attribute.defaultValue
      })),
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      created_by: this.createdBy,
      deleted_at: this.deletedAt
    }
    if (this.revision !== null) document._rev = this.revision
    return document
  }

  parseDocument(document: TemplateDocument): void {
    this.id = document._id
    this.revision = document._rev ?? null
    this.name = document.name
    this.attributes = (document.template_attributes ?? []).map((attribute) => ({
      name: attribute.name,
      type: attribute.type,
      templateId: attribute.template_id ?? null,
      defaultValue: attribute.default_value ?? null
    }))
    this.createdAt = document.created_at
    this.updatedAt = document.updated_at
    this.createdBy = document.created_by
    this.deletedAt = document.deleted_at ?? null
  }
}
