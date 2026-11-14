import type { Neuron } from './Neuron.js'
import type { Template } from './Template.js'

export interface NeuronChange {
  id: string
  parentId: string | null
  previousParentId: string | null
  deletedAt: string | null
  revision: string
  neuron: Neuron | null
}

export type NeuronChangeListener = (change: NeuronChange) => void

// Templates ride the same feed. A watcher that only cares about neurons leaves
// the handler out and never hears about them.
export interface TemplateChange {
  id: string
  deletedAt: string | null
  revision: string
  template: Template | null
}

export type TemplateChangeListener = (change: TemplateChange) => void

export interface WatchHandlers {
  change: NeuronChangeListener
  template?: TemplateChangeListener
  error?: (error: Error) => void
  /** Called with false when the feed drops and true once it is back. */
  live?: (isLive: boolean) => void
}
