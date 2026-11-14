import { Neuron, type NeuronDocument } from './Neuron.js'

export const STRING_NEURON_TYPE = 'string'

export interface StringNeuronDocument extends NeuronDocument {
  value: string
}

export interface StringNeuronProperties {
  name?: string | null
  value?: string
  parentId?: string | null
}

export class StringNeuron extends Neuron {
  readonly type = STRING_NEURON_TYPE
  value: string

  private constructor(value: string) {
    super()
    this.value = value
  }

  static create(properties: StringNeuronProperties = {}): StringNeuron {
    const neuron = new StringNeuron(properties.value ?? '')
    neuron.name = properties.name ?? null
    neuron.parentId = properties.parentId ?? null
    return neuron
  }

  static fromDocument(document: StringNeuronDocument): StringNeuron {
    const neuron = new StringNeuron('')
    neuron.parseDocument(document)
    return neuron
  }

  override toDocument(): StringNeuronDocument {
    return { ...this.toBaseDocument(), value: this.value }
  }

  override parseDocument(document: StringNeuronDocument): void {
    this.parseBaseDocument(document)
    this.value = document.value
  }
}
