import { Neuron, type NeuronDocument } from './Neuron.js'

export const OBJECT_NEURON_TYPE = 'object'

export interface ObjectNeuronDocument extends NeuronDocument {
  template_id: string | null
}

export interface ObjectNeuronProperties {
  name?: string | null
  parentId?: string | null
  templateId?: string | null
}

export class ObjectNeuron extends Neuron {
  readonly type = OBJECT_NEURON_TYPE
  templateId: string | null

  private constructor() {
    super()
    this.templateId = null
  }

  static create(properties: ObjectNeuronProperties = {}): ObjectNeuron {
    const neuron = new ObjectNeuron()
    neuron.name = properties.name ?? null
    neuron.parentId = properties.parentId ?? null
    neuron.templateId = properties.templateId ?? null
    return neuron
  }

  static fromDocument(document: ObjectNeuronDocument): ObjectNeuron {
    const neuron = new ObjectNeuron()
    neuron.parseDocument(document)
    return neuron
  }

  override toDocument(): ObjectNeuronDocument {
    return { ...this.toBaseDocument(), template_id: this.templateId }
  }

  override parseDocument(document: ObjectNeuronDocument): void {
    this.parseBaseDocument(document)
    this.templateId = document.template_id ?? null
  }
}
