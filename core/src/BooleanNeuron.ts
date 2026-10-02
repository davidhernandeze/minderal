import { Neuron, type NeuronDocument } from './Neuron.js'

export const BOOLEAN_NEURON_TYPE = 'boolean'

export interface BooleanNeuronDocument extends NeuronDocument {
  value: boolean
}

export interface BooleanNeuronProperties {
  name?: string | null
  value?: boolean
  parentId?: string | null
}

export class BooleanNeuron extends Neuron {
  readonly type = BOOLEAN_NEURON_TYPE
  value: boolean

  private constructor(value: boolean) {
    super()
    this.value = value
  }

  static create(properties: BooleanNeuronProperties = {}): BooleanNeuron {
    const neuron = new BooleanNeuron(properties.value ?? false)
    neuron.name = properties.name ?? null
    neuron.parentId = properties.parentId ?? null
    return neuron
  }

  static fromDocument(document: BooleanNeuronDocument): BooleanNeuron {
    const neuron = new BooleanNeuron(false)
    neuron.parseDocument(document)
    return neuron
  }

  override toDocument(): BooleanNeuronDocument {
    return { ...this.toBaseDocument(), value: this.value }
  }

  override parseDocument(document: BooleanNeuronDocument): void {
    this.parseBaseDocument(document)
    this.value = document.value
  }
}
