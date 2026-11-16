import type { Capability } from '../capabilities/Capability.js'
import { CapabilityUnavailableError } from '../errors.js'
import type { ClusterDocument, ClusterNode } from './ClusterDocument.js'

export interface ClusterView {
  readonly nodes: readonly ClusterNode[]
}

export class Cluster implements ClusterView {
  readonly nodes: readonly ClusterNode[]

  private constructor(nodes: readonly ClusterNode[]) {
    this.nodes = nodes
  }

  static fromDocument(document: ClusterDocument): Cluster {
    return new Cluster(document.nodes.map((node) => ({ ...node })))
  }

  async forward<Args extends readonly unknown[], Result>(capability: Capability<Args, Result>, _args: Args): Promise<Result> {
    throw new CapabilityUnavailableError(capability.id)
  }
}
