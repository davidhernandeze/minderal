import { BOOLEAN_NEURON_TYPE, BooleanNeuron, type BooleanNeuronDocument } from './BooleanNeuron.js'
import { NeuronError } from './NeuronError.js'
import type { Neuron, NeuronDocument } from './Neuron.js'
import { OBJECT_NEURON_TYPE, ObjectNeuron, type ObjectNeuronDocument } from './ObjectNeuron.js'
import { STRING_NEURON_TYPE, StringNeuron, type StringNeuronDocument } from './StringNeuron.js'

export class NeuronFactory {
  private constructor() {}

  static fromDocument(document: NeuronDocument): Neuron {
    if (isStringNeuronDocument(document)) return StringNeuron.fromDocument(document)
    if (isBooleanNeuronDocument(document)) return BooleanNeuron.fromDocument(document)
    if (isObjectNeuronDocument(document)) return ObjectNeuron.fromDocument(document)
    throw new NeuronError(
      `Document ${document._id} has no neuron type that can be read: ${JSON.stringify(document.type)}`
    )
  }
}

// The type decides which class reads the document; the shape of value is only a
// guard. A date would be stored as a string too, so structure alone could never
// tell these apart.
function isStringNeuronDocument(document: NeuronDocument): document is StringNeuronDocument {
  if (document.type !== STRING_NEURON_TYPE) return false
  return 'value' in document && typeof document.value === 'string'
}

function isBooleanNeuronDocument(document: NeuronDocument): document is BooleanNeuronDocument {
  if (document.type !== BOOLEAN_NEURON_TYPE) return false
  return 'value' in document && typeof document.value === 'boolean'
}

// An object holds no value of its own: its content is its attributes.
function isObjectNeuronDocument(document: NeuronDocument): document is ObjectNeuronDocument {
  return document.type === OBJECT_NEURON_TYPE
}
