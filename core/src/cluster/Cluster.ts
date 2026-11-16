import type { Capability } from '../capabilities/Capability.js'
import { resolveCapability, type CapabilityReference } from '../capabilities/methods.js'
import { CapabilityUnavailableError } from '../errors.js'
import type { ClusterDocument, ClusterNode } from './ClusterDocument.js'
import { delegate } from './delegate.js'
import { QualityLedger, type LinkQuality } from './QualityLedger.js'

/** A core's live view of its cluster. */
export interface ClusterView {
  readonly dataset: string
  readonly nodes: readonly ClusterNode[]
  /** This core's own node. */
  readonly self: ClusterNode | undefined
  readonly orchestrator: ClusterNode | undefined
  /** Nodes that announce a capability, named by `capabilities.x` or by the core method itself: `nodesWith(core.fetch)`. */
  nodesWith(capability: CapabilityReference): ClusterNode[]
  /** What this core has measured about its link to a node; undefined until it has talked to it. */
  qualityOf(nodeId: string): LinkQuality | undefined
  /** Called whenever the nodes or the measured link qualities change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export class Cluster implements ClusterView {
  private document: ClusterDocument
  private readonly selfId: string
  private readonly listeners: Set<() => void>
  private readonly ledger: QualityLedger

  constructor(document: ClusterDocument, selfId: string) {
    this.document = document
    this.selfId = selfId
    this.listeners = new Set()
    this.ledger = new QualityLedger(() => this.notify())
  }

  get dataset(): string {
    return this.document.dataset
  }

  get nodes(): readonly ClusterNode[] {
    return this.document.nodes
  }

  get self(): ClusterNode | undefined {
    return this.document.nodes.find((node) => node.id === this.selfId)
  }

  get orchestrator(): ClusterNode | undefined {
    return this.document.nodes.find((node) => node.role === 'orchestrator')
  }

  get revision(): string | undefined {
    return this.document._rev
  }

  get links(): QualityLedger {
    return this.ledger
  }

  nodesWith(reference: CapabilityReference): ClusterNode[] {
    const capability = resolveCapability(reference)
    return this.document.nodes.filter((node) => node.capabilities.includes(capability.id))
  }

  qualityOf(nodeId: string): LinkQuality | undefined {
    return this.ledger.get(nodeId)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Replaces the document if it is newer than the one held; returns whether it was. */
  update(document: ClusterDocument): boolean {
    if (document._rev !== undefined && document._rev === this.document._rev) return false
    if (revisionNumber(document._rev) < revisionNumber(this.document._rev)) return false
    this.document = document
    this.notify()
    return true
  }

  async forward<Args extends readonly unknown[], Result>(capability: Capability<Args, Result>, args: Args): Promise<Result> {
    const candidates = this.nodesWith(capability).filter((node) => node.id !== this.selfId && node.endpoint !== undefined)
    if (candidates.length === 0 || capability.wire === undefined) throw new CapabilityUnavailableError(capability.id)
    return delegate(capability, args, candidates, { selfId: this.selfId, ledger: this.ledger })
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // a failing listener must not break the core or the other listeners
      }
    }
  }
}

function revisionNumber(rev: string | undefined): number {
  if (rev === undefined) return 0
  return Number.parseInt(rev.split('-')[0] ?? '0', 10) || 0
}
