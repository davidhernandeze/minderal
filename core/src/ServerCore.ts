import { databaseCapability } from './capabilities/database/contract.js'
import type { ServeOptions } from './capabilities/serve/contract.js'
import type { ChangeNotice, Presence } from './cluster/channel.js'
import { CLUSTER_DOCUMENT_ID, newNode, withAnnouncement, withNode, type NodeAnnouncement } from './cluster/ClusterDocument.js'
import { readClusterDocument } from './cluster/clusterStorage.js'
import { RelayHub } from './cluster/RelayHub.js'
import { Core, type CoreContext } from './Core.js'
import { errorResponse, type CouchRequest, type CouchResponse } from './database/couchApi.js'
import { CouchError } from './database/CouchError.js'
import { CapabilityUnavailableError } from './errors.js'
import { HttpError } from './server/http.js'
import type { EndpointHost } from './server/DatasetEndpoint.js'
import { serveDataset, type ServedDataset } from './server/serveDataset.js'

export class ServerCore extends Core {
  readonly runtime: 'nodejs' = 'nodejs'
  private serving: Promise<ServedDataset> | undefined
  private servedUrl: string | undefined
  private hub: RelayHub | undefined
  private unsubscribeCluster: (() => void) | undefined
  private broadcastRevision: string | undefined
  private presenceTimer: ReturnType<typeof setTimeout> | undefined
  /** Which data holder each requester was last served by: replication goes smoother when it stays. */
  private readonly affinity: Map<string, string>

  private constructor(context: CoreContext) {
    super(context)
    this.affinity = new Map()
  }

  static create(context: CoreContext): ServerCore {
    return new ServerCore(context)
  }

  /** The `serve` capability's implementation; reached through `core.serve()`. */
  async startServing(options: ServeOptions): Promise<string> {
    this.serving ??= this.launch(options)
    try {
      return (await this.serving).url
    } catch (error) {
      this.serving = undefined
      throw error
    }
  }

  protected override currentEndpoint(): string | undefined {
    return this.servedUrl
  }

  protected override async beforeClose(): Promise<void> {
    this.unsubscribeCluster?.()
    clearTimeout(this.presenceTimer)
    this.hub?.close()
    this.hub = undefined
    const serving = this.serving
    this.serving = undefined
    if (serving === undefined) return
    let served: ServedDataset
    try {
      served = await serving
    } catch {
      return
    }
    await served.stop()
  }

  /** As orchestrator, notices go straight down every member's channel. */
  protected override async deliverNotice(notice: ChangeNotice): Promise<void> {
    const hub = this.hub
    if (hub === undefined) return super.deliverNotice(notice)
    hub.broadcast({ t: 'changed', ...notice })
  }

  protected override seqMoved(): void {
    if (this.hub === undefined) super.seqMoved()
    else this.schedulePresence()
  }

  private async launch(options: ServeOptions): Promise<ServedDataset> {
    if (this.role === 'orchestrator') this.hostChannels()
    const served = await serveDataset(this.datasetId, options, this.endpointHost(options.origins ?? []))
    this.servedUrl = served.url
    if (!this.writesClusterDocument()) {
      // a member announces its endpoint through the orchestrator; unreachable now, it retries on the next sync
      this.inBackground(this.announce())
      return served
    }
    try {
      await this.announce()
    } catch (error) {
      this.servedUrl = undefined
      await served.stop()
      throw error
    }
    return served
  }

  /**
   * As orchestrator: accept member channels, track who is online, push presence and cluster changes
   * down every channel, and relay requests to members through them.
   */
  private hostChannels(): void {
    const hub = new RelayHub(this.presenceTiming, () => {
      const online = this.presence()
      this.adoptPresence(online)
      hub.broadcast({ t: 'presence', online })
    })
    this.hub = hub
    this.adoptPresence(this.presence())
    this.setRelay(async (nodeId: string, capabilityId: string, args: unknown) => hub.open(nodeId, capabilityId, args))
    this.unsubscribeCluster = this.cluster.subscribe(() => {
      const revision = this.clusterRevision
      if (revision === undefined || revision === this.broadcastRevision) return
      this.broadcastRevision = revision
      this.inBackground(this.pushClusterDocument((message) => hub.broadcast(message)))
    })
  }

  private presence(): Presence[] {
    const seq = this.cluster.seqOf(this.nodeId)
    const self: Presence = {
      id: this.nodeId,
      since: this.cluster.onlineSince(this.nodeId) ?? new Date().toISOString(),
      ...(seq === undefined ? {} : { seq: seq.seq }),
      ...(seq?.changedAt === undefined ? {} : { changedAt: seq.changedAt }),
    }
    return [self, ...(this.hub?.presence() ?? [])]
  }

  /** Seqs move with every write: presence goes out at most every quarter second for them. */
  private schedulePresence(): void {
    const hub = this.hub
    if (hub === undefined || this.presenceTimer !== undefined) return
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = undefined
      if (this.hub !== hub) return
      const online = this.presence()
      this.adoptPresence(online)
      hub.broadcast({ t: 'presence', online })
    }, 250)
    ;(this.presenceTimer as { unref?: () => void }).unref?.()
  }

  /** A member's copy changed: pass its notice to everyone else, and to this core's own watchers. */
  private passOn(notice: ChangeNotice): boolean {
    const hub = this.hub
    if (hub === undefined || !hub.isOnline(notice.node)) return false
    if (hub.progress(notice.node, notice.seq)) this.schedulePresence()
    hub.broadcast({ t: 'changed', ...notice }, notice.node)
    this.hearNotice({ t: 'notice', notice })
    return true
  }

  private async pushClusterDocument(send: (message: { t: 'cluster'; document: unknown }) => void): Promise<void> {
    const document = await this.database.database.get(CLUSTER_DOCUMENT_ID, { revs: true })
    send({ t: 'cluster', document })
  }

  private endpointHost(origins: readonly string[]): EndpointHost {
    return {
      origins,
      status: async () => ({
        cluster: await readClusterDocument(this.database.database, this.datasetId),
        online: this.hub === undefined ? [] : this.presence(),
        holdsData: this.holdsData,
      }),
      join: async (announcement) => this.admit(announcement),
      announce: async (nodeId, announcement) => this.record(nodeId, announcement),
      isMember: (nodeId) => this.cluster.nodes.some((node) => node.id === nodeId),
      invoke: (capabilityId) => {
        const entry = this.platform.capabilities.forwardable(capabilityId)
        if (entry === undefined || this.isClosed || (capabilityId === databaseCapability.id && !this.holdsData)) return undefined
        return { capability: entry.capability, run: async (args) => entry.run(this, args) }
      },
      database: async (request, requester, signal, target) => this.answer(request, requester, signal, target),
      channel: (nodeId, sink) => {
        const hub = this.hub
        if (hub === undefined) return undefined
        const disconnect = hub.connect(nodeId, sink)
        sink.send({ t: 'presence', online: this.presence() })
        this.inBackground(this.pushClusterDocument((message) => sink.send(message)))
        return disconnect
      },
      heartbeat: (nodeId, seq) => {
        const hub = this.hub
        if (hub === undefined || !hub.heartbeat(nodeId)) return false
        if (seq !== undefined && hub.progress(nodeId, seq)) this.schedulePresence()
        return true
      },
      changed: (notice) => this.passOn(notice),
      reply: (nodeId, requestId, frames) => this.hub?.reply(nodeId, requestId, frames) ?? false,
      relay: async (nodeId, capabilityId, args, signal) => {
        const hub = this.hub
        if (hub === undefined) throw new HttpError(404, 'not_found', 'This node relays nothing; ask the orchestrator')
        return hub.open(nodeId, capabilityId, args, signal)
      },
    }
  }

  /**
   * Answers the CouchDB API: from the local copy, or — holding none, or asked for another node — by
   * relaying the request to an online member holding the data, other than the requester itself: `target`
   * only when given. With none online, 503: replicators retry, and the data is there again once a holder is.
   */
  private async answer(request: CouchRequest, requester: string | undefined, signal: AbortSignal, target?: string): Promise<CouchResponse> {
    if (this.holdsData && (target === undefined || target === this.nodeId)) return this.answerLocally(request, signal)
    const hub = this.hub
    const holders = this.cluster
      .nodesWith(databaseCapability)
      .filter((node) => node.id !== this.nodeId && node.id !== requester && hub?.isOnline(node.id) === true)
      .filter((node) => target === undefined || node.id === target)
    if (hub === undefined || holders.length === 0) {
      return errorResponse(new CouchError(503, 'unavailable', 'No node holding the data is online'))
    }
    const routes = holders.map((node) => ({
      node,
      open: async (capabilityId: string, args: unknown, _selfId: string, routeSignal?: AbortSignal) =>
        hub.open(node.id, capabilityId, args, routeSignal ?? signal),
    }))
    const prefer = target ?? (requester === undefined ? undefined : this.affinity.get(requester))
    try {
      const response = await this.forwardTo(databaseCapability, [request], routes, prefer, signal, request.query.feed !== 'longpoll')
      if (requester !== undefined && target === undefined) this.affinity.set(requester, response.servedBy)
      return response.result
    } catch (error) {
      if (error instanceof CapabilityUnavailableError) {
        return errorResponse(new CouchError(503, 'unavailable', 'No node holding the data could answer'))
      }
      return errorResponse(new CouchError(502, 'bad_gateway', error instanceof Error ? error.message : String(error)))
    }
  }

  /** The orchestrator's side of joining: the orchestrator generates the newcomer's node id. */
  private async admit(announcement: NodeAnnouncement): Promise<{ nodeId: string; cluster: unknown }> {
    this.requireOrchestrator()
    const node = newNode(crypto.randomUUID(), 'member', announcement, new Date())
    await this.changeClusterDocument((document) => withNode(document, node))
    return { nodeId: node.id, cluster: await this.database.database.get(CLUSTER_DOCUMENT_ID, { revs: true }) }
  }

  private async record(nodeId: string, announcement: NodeAnnouncement): Promise<unknown> {
    this.requireOrchestrator()
    if (!this.cluster.nodes.some((node) => node.id === nodeId)) {
      throw new HttpError(404, 'not_found', `Node ${nodeId} is not part of this cluster; join it first`)
    }
    return this.changeClusterDocument((document) => withAnnouncement(document, nodeId, announcement, new Date()))
  }

  private requireOrchestrator(): void {
    if (this.role !== 'orchestrator') {
      throw new HttpError(403, 'forbidden', 'This node is a member; join and announce through the orchestrator')
    }
  }
}

