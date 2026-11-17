import type { Capability } from '../capabilities/Capability.js'
import { resolveCapability, type CapabilityReference } from '../capabilities/methods.js'
import { CapabilityUnavailableError } from '../errors.js'
import type { ClusterDocument, ClusterNode } from './ClusterDocument.js'
import type { Presence } from './channel.js'
import { delegate, directRoute, relayedRoute, type Route } from './delegate.js'
import { QualityLedger, type LinkQuality } from './QualityLedger.js'

/** Relays a request to a node connected to this core's own channels — set on a serving orchestrator. */
export type LocalRelay = (nodeId: string, capabilityId: string, args: unknown, selfId: string, signal?: AbortSignal) => Promise<Response>

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
  /**
   * Whether a node is online as far as this core knows: connected to the orchestrator, or the
   * orchestrator itself while this core's channel to it is up. A core is always online to itself.
   */
  isOnline(nodeId: string): boolean
  /** When a node came online, as an ISO time; undefined while it is not. */
  onlineSince(nodeId: string): string | undefined
  /** Called whenever the nodes or the measured link qualities change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export class Cluster implements ClusterView {
  private document: ClusterDocument
  private readonly selfId: string
  private readonly listeners: Set<() => void>
  private readonly ledger: QualityLedger
  private readonly startedAt: string
  private online: ReadonlyMap<string, string>
  private relay: LocalRelay | undefined

  constructor(document: ClusterDocument, selfId: string) {
    this.document = document
    this.selfId = selfId
    this.listeners = new Set()
    this.ledger = new QualityLedger(() => this.notify())
    this.startedAt = new Date().toISOString()
    this.online = new Map()
    this.relay = undefined
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

  isOnline(nodeId: string): boolean {
    return nodeId === this.selfId || this.online.has(nodeId)
  }

  onlineSince(nodeId: string): string | undefined {
    if (nodeId === this.selfId) return this.online.get(nodeId) ?? this.startedAt
    return this.online.get(nodeId)
  }

  /** Replaces who is online. */
  setPresence(online: readonly Presence[]): void {
    const next = new Map(online.map((entry) => [entry.id, entry.since]))
    const same = next.size === this.online.size && [...next].every(([id, since]) => this.online.get(id) === since)
    if (same) return
    this.online = next
    this.notify()
  }

  setRelay(relay: LocalRelay | undefined): void {
    this.relay = relay
  }

  /** How this core can reach each other node announcing a capability, right now. */
  routesFor(capabilityId: string): Route[] {
    const orchestratorEndpoint = this.orchestrator?.id === this.selfId ? undefined : this.orchestrator?.endpoint
    const relay = this.relay
    const routes: Route[] = []
    for (const node of this.document.nodes) {
      if (node.id === this.selfId || !node.capabilities.includes(capabilityId)) continue
      if (node.endpoint !== undefined) routes.push(directRoute(node, node.endpoint))
      else if (relay !== undefined && this.online.has(node.id)) {
        routes.push({ node, open: async (capability, args, selfId, signal) => relay(node.id, capability, args, selfId, signal) })
      } else if (orchestratorEndpoint !== undefined && this.online.has(node.id)) routes.push(relayedRoute(node, orchestratorEndpoint))
    }
    return routes
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

  async forward<Args extends readonly unknown[], Result>(
    capability: Capability<Args, Result>,
    args: Args,
    options: {
      readonly routes?: readonly Route[]
      readonly prefer?: string
      readonly onServed?: (nodeId: string) => void
      readonly signal?: AbortSignal
      readonly measureLatency?: boolean
    } = {},
  ): Promise<Result> {
    const routes = options.routes ?? this.routesFor(capability.id)
    if (routes.length === 0 || capability.wire === undefined) throw new CapabilityUnavailableError(capability.id)
    return delegate(capability, args, routes, {
      selfId: this.selfId,
      ledger: this.ledger,
      ...(options.prefer === undefined ? {} : { prefer: options.prefer }),
      ...(options.onServed === undefined ? {} : { onServed: options.onServed }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.measureLatency === undefined ? {} : { measureLatency: options.measureLatency }),
    })
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
