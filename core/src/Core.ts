import type { NodeSetup } from './capabilities/CapabilitySet.js'
import { databaseCapability } from './capabilities/database/contract.js'
import { fetchCapability, parseHttpUrl, type FetchOptions } from './capabilities/fetch/contract.js'
import { bindCapabilityMethod } from './capabilities/methods.js'
import type { Capability } from './capabilities/Capability.js'
import { serveCapability, type ServeOptions } from './capabilities/serve/contract.js'
import { isPresenceList, parseChangeNotice, type ChangeNotice, type ChannelMessage, type Presence, type PresenceTiming } from './cluster/channel.js'
import { ChannelClient } from './cluster/ChannelClient.js'
import { Cluster, type ClusterView, type LocalRelay } from './cluster/Cluster.js'
import type { Route } from './cluster/delegate.js'
import { callCluster } from './cluster/clusterClient.js'
import { serializeError } from './cluster/frames.js'
import { NoticeBatcher } from './cluster/NoticeBatcher.js'
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
import { handleCouchRequest, writtenChanges, type CouchRequest, type CouchResponse, type WrittenChange } from './database/couchApi.js'
import { clusterStore, type NoticeEvent } from './dataset/ClusterStore.js'
import { Dataset } from './dataset/Dataset.js'
import type { DocumentStore } from './dataset/DocumentStore.js'
import { localStore } from './dataset/LocalStore.js'
import { PullScheduler } from './dataset/PullScheduler.js'
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

/** Members pull this many heartbeats apart even without notices, in case one was lost. */
const FALLBACK_PULL_HEARTBEATS = 30

export abstract class Core {
  abstract readonly runtime: Runtime
  readonly datasetId: string
  readonly nodeId: string
  /** The dataset's documents: raw access, provisional until the neuron model lands. */
  readonly dataset: Dataset
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
  private livePush: { readonly stop: () => Promise<void> } | undefined
  private pulls: PullScheduler | undefined
  private fallbackTimer: ReturnType<typeof setInterval> | undefined
  /** Set on (re)connecting without orchestrator data: the next presence tells which holders to catch up from. */
  private catchUpOnPresence: boolean
  private readonly notices: NoticeBatcher
  private readonly noticeListeners: Set<(event: NoticeEvent) => void>
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
    this.catchUpOnPresence = false
    this.notices = new NoticeBatcher(async (changes) => this.sendNotice(changes))
    this.noticeListeners = new Set()
    const store: DocumentStore = this.holdsData
      ? localStore(this.database.database, this.datasetId, (changes) => this.noteWrites(changes))
      : clusterStore(
          async (request, signal, node) => this.askForData(request, signal, node),
          (listener) => {
            this.noticeListeners.add(listener)
            return () => this.noticeListeners.delete(listener)
          },
          this.datasetId,
        )
    this.dataset = new Dataset(
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
   * Syncs with the cluster now, both ways, and resolves once done. Members also sync on their own while
   * they can reach the cluster — pulling whenever a change notice arrives — so this is for when you need
   * to know it happened. A core with nowhere to sync to — an orchestrator, a dataset of one — reports
   * nothing moved.
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
      this.dataset.stopWatching()
      this.noticeListeners.clear()
      this.notices.close()
      clearInterval(this.fallbackTimer)
      this.clusterFeed?.cancel()
      for (const relayed of this.relayed.values()) relayed.abort()
      await this.channel?.stop()
      await this.pulls?.close()
      await this.livePush?.stop()
      await Promise.allSettled([...this.background])
      await this.beforeClose()
    } finally {
      await this.database.release()
    }
  }

  async [startCore](): Promise<void> {
    await this.followOwnChanges()
    if (this.writesClusterDocument()) {
      await this.announce()
      return
    }
    if (this.holdsData) {
      this.pulls = new PullScheduler(this.database.database, (url) => this.platform.openRemote(url, this.nodeId))
      if (this.orchestratorHoldsData()) this.startLivePush()
    }
    this.openChannel()
    this.inBackground(this.announce())
  }

  async [answerDatabase](request: CouchRequest): Promise<CouchResponse> {
    if (!this.holdsData) throw new CapabilityUnavailableError(databaseCapability.id)
    return this.answerLocally(request, this.lifetime.signal)
  }

  /** Answers a CouchDB API request from this core's copy, telling the cluster about what it wrote. */
  protected async answerLocally(request: CouchRequest, signal: AbortSignal): Promise<CouchResponse> {
    // long-polls end when the core closes; a cancelled relay is not passed down yet, so its wait runs out instead
    const response = await handleCouchRequest({ database: this.database.database, name: `minderal-${this.datasetId}`, signal }, request)
    this.noteWrites(writtenChanges(request, response))
    return response
  }

  /**
   * Writes applied to this core's copy, to tell the cluster about. Only the node that applies a write
   * tells: the orchestrator when it holds the data — members' writes reach it by their push — or, when
   * it holds none, each member holding a copy, whose notices it passes on.
   */
  protected noteWrites(changes: readonly WrittenChange[]): void {
    if (changes.length > 0 && this.emitsNotices()) this.notices.add(changes)
  }

  /** Passes a notice on to this core's own listeners: client-mode watchers. */
  protected hearNotice(event: NoticeEvent): void {
    for (const listener of [...this.noticeListeners]) {
      try {
        listener(event)
      } catch {
        // a failing listener must not break the others
      }
    }
  }

  /** Sends this core's notice where it goes: up its channel; an orchestrator overrides it to broadcast. */
  protected async deliverNotice(notice: ChangeNotice): Promise<void> {
    await this.channel?.notify(notice)
  }

  /** Where this core's changes feed moved: members report it on their heartbeat; an orchestrator overrides. */
  protected seqMoved(): void {
    this.channel?.reportSoon()
  }

  protected orchestratorHoldsData(): boolean {
    return this.clusterState.orchestrator?.capabilities.includes(databaseCapability.id) === true
  }

  private emitsNotices(): boolean {
    if (!this.holdsData) return false
    const orchestrator = this.clusterState.orchestrator
    if (orchestrator === undefined) return false
    return orchestrator.id === this.nodeId || !this.orchestratorHoldsData()
  }

  private async sendNotice(changes: readonly WrittenChange[]): Promise<void> {
    if (this.closed) return
    const { update_seq: seq } = await this.database.database.info()
    await this.deliverNotice({ node: this.nodeId, seq, changes })
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
   * Client mode: a CouchDB API request answered by a node holding the data — `node` when given, else
   * the one that answered last when it still can, so this core reads what it just wrote.
   */
  private async askForData(request: CouchRequest, signal?: AbortSignal, node?: string): Promise<{ response: CouchResponse; servedBy: string }> {
    const lifetime = this.lifetime.signal
    const combined = signal === undefined ? lifetime : AbortSignal.any([signal, lifetime])
    const routes = this.clusterState.routesFor(databaseCapability.id).filter((route) => node === undefined || route.node.id === node)
    if (routes.length === 0) throw new CapabilityUnavailableError(databaseCapability.id)
    const { result, servedBy } = await this.forwardTo(databaseCapability, [request], routes, node ?? this.dataNode, combined, !isLongPoll(request))
    if (node === undefined) this.dataNode = servedBy
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



  /**
   * The member's channel to its orchestrator: presence, cluster changes and relayed requests arrive on
   * it. While it is down, this core knows nobody to be online but itself.
   */
  private openChannel(): void {
    const channel = new ChannelClient({
      nodeId: this.nodeId,
      endpoint: () => this.upstream(),
      onMessage: (message) => this.onChannelMessage(message),
      onConnection: (connected) => (connected ? this.onConnected() : this.onDisconnected()),
      ...(this.holdsData ? { seq: () => this.clusterState.seqOf(this.nodeId)?.seq } : {}),
    })
    this.channel = channel
    channel.start()
  }

  /**
   * The channel is up, maybe after a gap: catch up on what changed meanwhile — from the orchestrator
   * when it holds the data; else from every holder online, which the presence list arriving next names,
   * while telling them where this copy is so they pull from it — and keep pulling now and then.
   */
  private onConnected(): void {
    if (this.closed) return
    if (this.announcementPending) this.inBackground(this.announce())
    this.hearNotice({ t: 'reconnected' })
    if (this.pulls === undefined) return
    if (this.orchestratorHoldsData()) this.pullFromOrchestrator()
    else {
      this.catchUpOnPresence = true
      if (this.emitsNotices()) this.inBackground(this.sendNotice([]))
    }
  }

  private onDisconnected(): void {
    this.clusterState.setPresence([])
    clearInterval(this.fallbackTimer)
    this.fallbackTimer = undefined
    this.catchUpOnPresence = false
  }

  private onChannelMessage(message: ChannelMessage): void {
    switch (message.t) {
      case 'welcome':
        clearInterval(this.fallbackTimer)
        if (this.pulls !== undefined) {
          this.fallbackTimer = setInterval(() => this.pullEverywhere(), message.heartbeatMs * FALLBACK_PULL_HEARTBEATS)
        }
        return
      case 'presence':
        if (!isPresenceList(message.online)) return
        this.clusterState.setPresence(message.online)
        if (this.catchUpOnPresence) {
          this.catchUpOnPresence = false
          this.pullEverywhere()
        }
        return
      case 'changed': {
        const notice = parseChangeNotice(message)
        if (notice !== undefined) this.onNotice(notice)
        return
      }
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

  /**
   * Another node's copy changed. Holding a copy, pull: from the orchestrator when it holds the data
   * (its notices are the only ones), else straight from the node that changed — through the relay
   * when it has no endpoint — so the change does not wait for other holders to pass it along.
   */
  private onNotice(notice: ChangeNotice): void {
    if (notice.node === this.nodeId) return
    this.clusterState.noteSeq(notice.node, notice.seq)
    this.hearNotice({ t: 'notice', notice })
    if (this.pulls === undefined) return
    if (this.orchestratorHoldsData()) {
      if (notice.node === this.clusterState.orchestrator?.id) this.pullFromOrchestrator()
      return
    }
    this.pullFrom(notice.node)
  }

  private pullFromOrchestrator(): void {
    const upstream = this.upstream()
    if (upstream !== undefined) this.pulls?.request(upstream)
  }

  private pullFrom(nodeId: string): void {
    const node = this.clusterState.nodes.find((candidate) => candidate.id === nodeId)
    const upstream = this.upstream()
    if (node === undefined || !node.capabilities.includes(databaseCapability.id)) return
    if (node.endpoint !== undefined) this.pulls?.request(node.endpoint)
    else if (upstream !== undefined) this.pulls?.request(`${upstream.replace(/\/+$/, '')}/_minderal/nodes/${encodeURIComponent(nodeId)}/db`)
  }

  /** Catch-up and fallback: pull from the orchestrator holding the data, or from every holder online. */
  private pullEverywhere(): void {
    if (this.closed || this.pulls === undefined) return
    if (this.orchestratorHoldsData()) {
      this.pullFromOrchestrator()
      return
    }
    for (const node of this.clusterState.nodesWith(databaseCapability)) {
      if (node.id !== this.nodeId && this.clusterState.isOnline(node.id)) this.pullFrom(node.id)
    }
  }

  /**
   * With an orchestrator holding the data, members push their writes to it as they happen — reading
   * only their own changes feed, so nothing is held open on the network — and it tells everyone.
   */
  private startLivePush(): void {
    const upstream = this.upstream()
    if (upstream === undefined) return
    const remote = this.platform.openRemote(upstream, this.nodeId)
    const push = this.database.database.replicate.to(remote, {
      live: true,
      retry: true,
      back_off_function: (delay) => (delay === 0 ? 1000 : Math.min(delay * 2, LIVE_SYNC_MAX_BACKOFF_MS)),
    })
    const completed = new Promise<void>((resolve) => {
      push.on('complete', () => resolve())
      push.on('error', () => resolve())
    })
    push.on('active', () => {
      if (this.announcementPending && !this.closed) this.inBackground(this.announce())
    })
    this.livePush = {
      stop: async () => {
        push.cancel()
        await Promise.race([completed, new Promise((resolve) => setTimeout(resolve, 2000))])
        await remote.close().catch(() => undefined)
      },
    }
  }

  /**
   * Follows this core's own changes feed — local, nothing on the network — for two things: the cluster
   * document, which every core keeps current from its copy, and where the feed is, which the cluster
   * shows for every node holding a copy. One feed for both: each live feed costs a query per write.
   */
  private async followOwnChanges(): Promise<void> {
    const database = this.database.database
    if (this.holdsData) this.clusterState.setOwnSeq((await database.info()).update_seq, undefined)
    const feed = database.changes({ since: 'now', live: true })
    feed.on('change', (change) => {
      if (change.id === CLUSTER_DOCUMENT_ID) this.inBackground(this.reloadClusterDocument())
      if (!this.holdsData) return
      this.clusterState.setOwnSeq(change.seq, new Date().toISOString())
      this.seqMoved()
    })
    feed.on('error', () => undefined)
    this.clusterFeed = feed
  }

  private async reloadClusterDocument(): Promise<void> {
    const document: unknown = await this.database.database.get(CLUSTER_DOCUMENT_ID)
    if (isClusterDocument(document) && document.dataset === this.datasetId) this.clusterState.update(document)
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
