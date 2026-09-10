import { NeuronError } from './NeuronError.js'
import type { Neuron, NeuronDocument } from './Neuron.js'
import { STRING_NEURON_TYPE, StringNeuron, type StringNeuronDocument } from './StringNeuron.js'

export class NeuronFactory {
  private constructor() {}

  static fromDocument(document: NeuronDocument): Neuron {
    if (isStringNeuronDocument(document)) return StringNeuron.fromDocument(document)
    throw new NeuronError(
      `Document ${document._id} has no neuron type that can be read: ${JSON.stringify(document.type)}`
    )
  }
}

function isStringNeuronDocument(document: NeuronDocument): document is StringNeuronDocument {
  if (document.type !== STRING_NEURON_TYPE) return false
  if (!('value' in document) || typeof document.value !== 'string') return false
  return 'name' in document && (typeof document.name === 'string' || document.name === null)
}
