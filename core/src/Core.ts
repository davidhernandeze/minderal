import type { NodeSetup } from './capabilities/CapabilitySet.js'
import { databaseCapability } from './capabilities/database/contract.js'
import { fetchCapability, parseHttpUrl, type FetchOptions } from './capabilities/fetch/contract.js'
import { bindCapabilityMethod } from './capabilities/methods.js'
import type { Capability } from './capabilities/Capability.js'
import { serveCapability, type ServeOptions } from './capabilities/serve/contract.js'
import { isPresenceList, type ChannelMessage, type Presence, type PresenceTiming } from './cluster/channel.js'
import { ChannelClient } from './cluster/ChannelClient.js'
import { Cluster, type ClusterView, type LocalRelay } from './cluster/Cluster.js'
import type { Route } from './cluster/delegate.js'
import { callCluster } from './cluster/clusterClient.js'
import { serializeError } from './cluster/frames.js'
import { produceFrames } from './cluster/produceFrames.js'
import {
  CLUSTER_DOCUMENT_ID,
  announcementChanges,
  isClusterDocument,
  withAnnouncement,
  type ClusterDocument,
  type NodeAnnouncement,
  type NodeRole,
} from './cluster/ClusterDocument.js'
import { updateClusterDocument } from './cluster/clusterStorage.js'
import { handleCouchRequest, type CouchRequest, type CouchResponse } from './database/couchApi.js'
import { clusterStore } from './documents/ClusterStore.js'
import { Documents } from './documents/Documents.js'
import type { DocumentStore } from './documents/DocumentStore.js'
import { localStore } from './documents/LocalStore.js'
import { CapabilityUnavailableError, ClusterError, CoreClosedError, NetworkError } from './errors.js'
import type { Platform } from './platform/Platform.js'
import type { Runtime } from './Runtime.js'
import type { DatabaseHandle } from './storage/DatabasePool.js'
import { CORE_VERSION } from './version.js'

export interface CoreContext {
  readonly platform: Platform
  readonly datasetId: string
  readonly nodeId: string
  readonly database: DatabaseHandle
  readonly cluster: ClusterDocument
  /** Endpoints this node joined through, used to reach the cluster before the cluster document names one. */
  readonly bootstrap: readonly string[]
  /** A name the user gave this node now, replacing the one on record. */
  readonly name: string | undefined
  /** False for a core holding no copy of the dataset: its database holds the cluster document only. */
  readonly holdsData: boolean
  /** Lease timing an orchestrator gives its members. */
  readonly presence: PresenceTiming
}

export interface SyncReport {
  readonly pushed: number
  readonly pulled: number
}

/** Starts a core once created; internal to the library, so implementers never see it on `Core`. */
export const startCore: unique symbol = Symbol('startCore')

/** Answers a CouchDB API request from the core's own copy; the `database` capability's implementation. */
export const answerDatabase: unique symbol = Symbol('answerDatabase')

const LIVE_SYNC_MAX_BACKOFF_MS = 30_000

export abstract class Core {
  abstract readonly runtime: Runtime
  readonly datasetId: string
  readonly nodeId: string
  /** Raw document access; provisional until the neuron model lands. */
  readonly documents: Documents
  /** Whether this core holds a copy of the dataset. An orchestrator may hold none and serve its members' data. */
  readonly holdsData: boolean
  protected readonly database: DatabaseHandle
  protected readonly presenceTiming: PresenceTiming
  protected readonly platform: Platform
  private readonly clusterState: Cluster
  private readonly bootstrap: readonly string[]
  private readonly requestedName: string | undefined
  private readonly lifetime: AbortController
  private readonly background: Set<Promise<unknown>>
  private clusterFeed: PouchDB.Core.Changes<object> | undefined
  private liveSync: { readonly stop: () => Promise<void> } | undefined
  private channel: ChannelClient | undefined
  private readonly relayed: Map<string, AbortController>
  /** The node holding the data that answered this core last: asked first next time, to read its own writes. */
  private dataNode: string | undefined
  private announcementPending: boolean
  private closed: boolean

  protected constructor(context: CoreContext) {
    this.platform = context.platform
    this.datasetId = context.datasetId
    this.nodeId = context.nodeId
    this.database = context.database
    this.clusterState = new Cluster(context.cluster, context.nodeId)
    this.bootstrap = context.bootstrap
    this.requestedName = context.name
    this.lifetime = new AbortController()
    this.background = new Set()
    this.holdsData = context.holdsData
    this.presenceTiming = context.presence
    this.relayed = new Map()
    this.announcementPending = false
    this.closed = false
    const store: DocumentStore = this.holdsData
      ? localStore(this.database.database, this.datasetId)
      : clusterStore(async (request, signal) => this.askForData(request, signal), this.datasetId)
    this.documents = new Documents(
      () => store,
      () => this.ensureOpen(),
    )
  }

  get cluster(): ClusterView {
    return this.clusterState
  }

  get role(): NodeRole {
    return this.clusterState.self?.role ?? 'member'
  }

  get isClosed(): boolean {
    return this.closed
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    return this.perform(fetchCapability, [parseHttpUrl(url).href, options])
  }

  async serve(options: ServeOptions = {}): Promise<string> {
    return this.performLocally(serveCapability, [options])
  }

  /**
   * Syncs with the cluster now, both ways, and resolves once done. Members also sync continuously in the
   * background while they can reach the cluster; this is for when you need to know it happened. A core
   * with nowhere to sync to — an orchestrator, a dataset of one — reports nothing moved.
   */
  async sync(): Promise<SyncReport> {
    this.ensureOpen()
    const upstream = this.upstream()
    if (upstream === undefined || !this.holdsData) return { pushed: 0, pulled: 0 }
    if (this.announcementPending) await this.announce().catch(() => undefined)
    const remote = this.platform.openRemote(upstream, this.nodeId)
    try {
      const result = await this.database.database.sync(remote)
      return { pushed: result.push?.docs_written ?? 0, pulled: result.pull?.docs_written ?? 0 }
    } catch (cause) {
      // an orchestrator without data answers 503 while no node holding the data is online
      if (statusOf(cause) === 503) throw new CapabilityUnavailableError(databaseCapability.id)
      throw new NetworkError(upstream, cause)
    } finally {
      await remote.close()
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.lifetime.abort()
    try {
      this.documents.stopWatching()
      this.clusterFeed?.cancel()
      for (const relayed of this.relayed.values()) relayed.abort()
      await this.channel?.stop()
      await this.liveSync?.stop()
      await Promise.allSettled([...this.background])
      await this.beforeClose()
    } finally {
      await this.database.release()
    }
  }

  async [startCore](): Promise<void> {
    this.watchClusterDocument()
    if (this.writesClusterDocument()) {
      await this.announce()
      return
    }
    this.startLiveSync()
    this.openChannel()
    this.inBackground(this.announce())
  }

  async [answerDatabase](request: CouchRequest): Promise<CouchResponse> {
    if (!this.holdsData) throw new CapabilityUnavailableError(databaseCapability.id)
    // long-polls end when the core closes; a cancelled relay is not passed down yet, so its wait runs out instead
    return handleCouchRequest({ database: this.database.database, name: `minderal-${this.datasetId}`, signal: this.lifetime.signal }, request)
  }

  /** How this node is set up, for capability availability probes. */
  protected get setup(): NodeSetup {
    return { holdsData: this.holdsData }
  }

  /** Where this node is reachable, once it serves. */
  protected currentEndpoint(): string | undefined {
    return undefined
  }

  protected async beforeClose(): Promise<void> {}

  /**
   * Whether this core writes the cluster document itself: the orchestrator does, and so does the only node
   * of a dataset without one. Everyone else asks the orchestrator.
   */
  protected writesClusterDocument(): boolean {
    return this.clusterState.self?.role === 'orchestrator' || this.clusterState.orchestrator === undefined
  }

  protected async changeClusterDocument(change: (document: ClusterDocument) => ClusterDocument | undefined): Promise<ClusterDocument> {
    const document = await updateClusterDocument(this.database.database, this.datasetId, change)
    this.clusterState.update(document)
    return document
  }

  protected adoptClusterDocument(document: ClusterDocument): void {
    this.clusterState.update(document)
  }

  protected get links(): Cluster['links'] {
    return this.clusterState.links
  }

  protected get clusterRevision(): string | undefined {
    return this.clusterState.revision
  }

  protected adoptPresence(online: readonly Presence[]): void {
    this.clusterState.setPresence(online)
  }

  protected setRelay(relay: LocalRelay | undefined): void {
    this.clusterState.setRelay(relay)
  }

  /** Delegates over given routes, reporting which node answered. */
  protected async forwardTo<Args extends readonly unknown[], Result>(
    capability: Capability<Args, Result>,
    args: Args,
    routes: readonly Route[],
    prefer: string | undefined,
    signal?: AbortSignal,
    measureLatency = true,
  ): Promise<{ result: Result; servedBy: string }> {
    let servedBy = ''
    const result = await this.clusterState.forward(capability, args, {
      routes,
      measureLatency,
      ...(prefer === undefined ? {} : { prefer }),
      ...(signal === undefined ? {} : { signal }),
      onServed: (nodeId) => (servedBy = nodeId),
    })
    return { result, servedBy }
  }

  /**
   * Client mode: a CouchDB API request answered by a node holding the data, the one that answered last
   * when it still can, so this core reads what it just wrote.
   */
  private async askForData(request: CouchRequest, signal?: AbortSignal): Promise<{ response: CouchResponse; servedBy: string }> {
    const lifetime = this.lifetime.signal
    const combined = signal === undefined ? lifetime : AbortSignal.any([signal, lifetime])
    const routes = this.clusterState.routesFor(databaseCapability.id)
    if (routes.length === 0) throw new CapabilityUnavailableError(databaseCapability.id)
    const { result, servedBy } = await this.forwardTo(databaseCapability, [request], routes, this.dataNode, combined, !isLongPoll(request))
    this.dataNode = servedBy
    return { response: result, servedBy }
  }

  /**
   * Records what this node is — name, runtime, core version, capabilities, endpoint — in the cluster
   * document, writing it locally or through the orchestrator. Only writes when something changed.
   * A member that cannot reach the orchestrator keeps the announcement pending and retries on its next sync.
   */
  protected async announce(): Promise<void> {
    const announcement = await this.describeSelf()
    const self = this.clusterState.self
    if (self !== undefined && !announcementChanges(self, announcement)) {
      this.announcementPending = false
      return
    }
    if (this.writesClusterDocument()) {
      await this.changeClusterDocument((document) => withAnnouncement(document, this.nodeId, announcement, new Date()))
      this.announcementPending = false
      return
    }
    const upstream = this.upstream()
    if (upstream === undefined) throw new CapabilityUnavailableError('announce')
    const orchestrator = this.clusterState.orchestrator
    this.announcementPending = true
    try {
      const { value, latencyMs } = await callCluster(upstream, 'announce', { nodeId: this.nodeId, node: announcement }, this.lifetime.signal)
      if (orchestrator !== undefined) this.links.recordSuccess(orchestrator.id, latencyMs)
      const cluster = typeof value === 'object' && value !== null && 'cluster' in value ? value.cluster : undefined
      if (!isClusterDocument(cluster)) throw new ClusterError(upstream, 'answered an announcement without a cluster document')
      this.adoptClusterDocument(cluster)
      this.announcementPending = false
    } catch (error) {
      if (orchestrator !== undefined && error instanceof NetworkError) this.links.recordFailure(orchestrator.id, 'is unreachable')
      throw error
    }
  }

  protected inBackground(task: Promise<unknown>): void {
    const settled = task.catch(() => undefined).finally(() => this.background.delete(settled))
    this.background.add(settled)
  }

  private async describeSelf(): Promise<NodeAnnouncement> {
    const description = this.platform.describeNode()
    const endpoint = this.currentEndpoint()
    return {
      name: this.requestedName ?? this.clusterState.self?.name ?? description.defaultName,
      runtime: this.runtime,
      coreVersion: CORE_VERSION,
      capabilities: await this.platform.capabilities.availableIds(this.setup),
      ...(description.userAgent === undefined ? {} : { userAgent: description.userAgent }),
      ...(description.os === undefined ? {} : { os: description.os }),
      ...(endpoint === undefined ? {} : { endpoint }),
    }
  }

  /** The endpoint this node syncs and announces through: the orchestrator's, or the one it joined through. */
  private upstream(): string | undefined {
    if (this.clusterState.self?.role === 'orchestrator') return undefined
    return this.clusterState.orchestrator?.endpoint ?? this.bootstrap[0]
  }

  private watchClusterDocument(): void {
    const feed = this.database.database.changes({ since: 'now', live: true, doc_ids: [CLUSTER_DOCUMENT_ID], include_docs: true })
    feed.on('change', (change) => {
      if (isClusterDocument(change.doc) && change.doc.dataset === this.datasetId) this.clusterState.update(change.doc)
    })
    feed.on('error', () => undefined)
    this.clusterFeed = feed
  }

  /**
   * The member's channel to its orchestrator: presence, cluster changes and relayed requests arrive on
   * it. While it is down, this core knows nobody to be online but itself.
   */
  private openChannel(): void {
    const channel = new ChannelClient({
      nodeId: this.nodeId,
      endpoint: () => this.upstream(),
      onMessage: (message) => this.onChannelMessage(message),
      onConnection: (connected) => {
        if (!connected) this.clusterState.setPresence([])
        else if (this.announcementPending && !this.closed) this.inBackground(this.announce())
      },
    })
    this.channel = channel
    channel.start()
  }

  private onChannelMessage(message: ChannelMessage): void {
    switch (message.t) {
      case 'presence':
        if (isPresenceList(message.online)) this.clusterState.setPresence(message.online)
        return
      case 'cluster':
        this.inBackground(this.storePushedClusterDocument(message.document))
        return
      case 'request':
        this.inBackground(this.answerRelayed(message.id, message.capability, message.args))
        return
      case 'cancel':
        this.relayed.get(message.id)?.abort()
        return
      default:
    }
  }

  /** Keeps the orchestrator's revision of the cluster document, history included, so every copy converges. */
  private async storePushedClusterDocument(document: unknown): Promise<void> {
    if (!isClusterDocument(document) || document.dataset !== this.datasetId || document._rev === undefined) return
    await this.database.database.bulkDocs([document as unknown as PouchDB.Core.PutDocument<object>], { new_edits: false })
    this.clusterState.update(document)
  }

  /** Performs a capability another node asked for through the orchestrator, answering frame by frame. */
  private async answerRelayed(requestId: string, capabilityId: string, args: unknown): Promise<void> {
    const channel = this.channel
    if (channel === undefined) return
    const abort = new AbortController()
    this.relayed.set(requestId, abort)
    try {
      const entry = this.platform.capabilities.forwardable(capabilityId)
      const available = entry !== undefined && (await this.platform.capabilities.isAvailable(capabilityId, this.setup))
      if (entry === undefined || !available) {
        await channel.reply(requestId, [{ t: 'error', e: serializeError(new CapabilityUnavailableError(capabilityId)) }])
        return
      }
      for await (const frame of produceFrames(entry.capability, args, async (decoded) => entry.run(this, decoded))) {
        if (abort.signal.aborted || !(await channel.reply(requestId, [frame]))) break
      }
    } finally {
      this.relayed.delete(requestId)
    }
  }

  private startLiveSync(): void {
    const upstream = this.upstream()
    if (upstream === undefined || !this.holdsData) return
    const remote = this.platform.openRemote(upstream, this.nodeId)
    const sync = this.database.database.sync(remote, {
      live: true,
      retry: true,
      back_off_function: (delay) => (delay === 0 ? 1000 : Math.min(delay * 2, LIVE_SYNC_MAX_BACKOFF_MS)),
    })
    const completed = new Promise<void>((resolve) => {
      sync.on('complete', () => resolve())
      sync.on('error', () => resolve())
    })
    sync.on('active', () => {
      if (this.announcementPending && !this.closed) this.inBackground(this.announce())
    })
    this.liveSync = {
      stop: async () => {
        sync.cancel()
        await Promise.race([completed, new Promise((resolve) => setTimeout(resolve, 2000))])
        await remote.close().catch(() => undefined)
      },
    }
  }

  private ensureOpen(): void {
    if (this.closed) throw new CoreClosedError(this.datasetId)
  }

  private async perform<Args extends readonly unknown[], Result>(capability: Capability<Args, Result>, args: Args): Promise<Result> {
    this.ensureOpen()
    const local = this.platform.capabilities.get(capability)
    if (local !== undefined) return local(this, ...args)
    return this.clusterState.forward(capability, args)
  }

  private async performLocally<Args extends readonly unknown[], Result>(capability: Capability<Args, Result>, args: Args): Promise<Result> {
    this.ensureOpen()
    const local = this.platform.capabilities.get(capability)
    if (local === undefined) throw new CapabilityUnavailableError(capability.id)
    return local(this, ...args)
  }
}

function isLongPoll(request: CouchRequest): boolean {
  return request.query.feed === 'longpoll'
}

function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
}

bindCapabilityMethod(Core.prototype.fetch, fetchCapability)
bindCapabilityMethod(Core.prototype.serve, serveCapability)
