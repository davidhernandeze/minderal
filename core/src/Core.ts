import { fetchCapability, parseHttpUrl, type FetchOptions } from './capabilities/fetch/contract.js'
import { bindCapabilityMethod } from './capabilities/methods.js'
import type { Capability } from './capabilities/Capability.js'
import { serveCapability, type ServeOptions } from './capabilities/serve/contract.js'
import { Cluster, type ClusterView } from './cluster/Cluster.js'
import { callCluster } from './cluster/clusterClient.js'
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
import { Documents } from './documents/Documents.js'
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
}

export interface SyncReport {
  readonly pushed: number
  readonly pulled: number
}

/** Starts a core once created; internal to the library, so implementers never see it on `Core`. */
export const startCore: unique symbol = Symbol('startCore')

const LIVE_SYNC_MAX_BACKOFF_MS = 30_000

export abstract class Core {
  abstract readonly runtime: Runtime
  readonly datasetId: string
  readonly nodeId: string
  /** Raw document access; provisional until the neuron model lands. */
  readonly documents: Documents
  protected readonly database: DatabaseHandle
  protected readonly platform: Platform
  private readonly clusterState: Cluster
  private readonly bootstrap: readonly string[]
  private readonly requestedName: string | undefined
  private readonly lifetime: AbortController
  private readonly background: Set<Promise<unknown>>
  private clusterFeed: PouchDB.Core.Changes<object> | undefined
  private liveSync: { readonly stop: () => Promise<void> } | undefined
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
    this.announcementPending = false
    this.closed = false
    this.documents = new Documents(() => this.database.database, this.datasetId, () => this.ensureOpen())
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
    if (upstream === undefined) return { pushed: 0, pulled: 0 }
    if (this.announcementPending) await this.announce().catch(() => undefined)
    const remote = this.platform.openRemote(upstream)
    try {
      const result = await this.database.database.sync(remote)
      return { pushed: result.push?.docs_written ?? 0, pulled: result.pull?.docs_written ?? 0 }
    } catch (cause) {
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
    this.inBackground(this.announce())
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
      capabilities: await this.platform.capabilities.availableIds(),
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

  private startLiveSync(): void {
    const upstream = this.upstream()
    if (upstream === undefined) return
    const remote = this.platform.openRemote(upstream)
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

bindCapabilityMethod(Core.prototype.fetch, fetchCapability)
bindCapabilityMethod(Core.prototype.serve, serveCapability)
