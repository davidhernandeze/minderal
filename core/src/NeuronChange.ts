import type { Neuron } from './Neuron.js'

export interface NeuronChange {
  id: string
  parentId: string | null
  previousParentId: string | null
  deletedAt: string | null
  revision: string
  neuron: Neuron | null
}

export type NeuronChangeListener = (change: NeuronChange) => void

export interface WatchHandlers {
  change: NeuronChangeListener
  error?: (error: Error) => void
  /** Called with false when the feed drops and true once it is back. */
  live?: (isLive: boolean) => void
}
