import type { Capability, Implementation } from './capabilities/Capability.js'
import { fetchCapability, parseHttpUrl, type FetchOptions } from './capabilities/fetch/contract.js'
import type { LocalCapabilities } from './capabilities/LocalCapabilities.js'
import { serveCapability, type ServeOptions } from './capabilities/serve/contract.js'
import { Cluster, type ClusterView } from './cluster/Cluster.js'
import type { ClusterDocument } from './cluster/ClusterDocument.js'
import { readClusterDocument, writeClusterDocument } from './cluster/clusterStorage.js'
import { CapabilityUnavailableError, CoreClosedError } from './errors.js'
import type { Runtime } from './Runtime.js'
import type { DatabaseHandle } from './storage/DatabasePool.js'

export interface CoreContext {
  readonly datasetId: string
  readonly nodeId: string
  readonly database: DatabaseHandle
  readonly cluster: Cluster
}

export abstract class Core {
  abstract readonly runtime: Runtime
  readonly datasetId: string
  readonly nodeId: string
  protected abstract readonly local: LocalCapabilities
  protected readonly database: DatabaseHandle
  private clusterState: Cluster
  private closed: boolean

  protected constructor(context: CoreContext) {
    this.datasetId = context.datasetId
    this.nodeId = context.nodeId
    this.database = context.database
    this.clusterState = context.cluster
    this.closed = false
  }

  get cluster(): ClusterView {
    return this.clusterState
  }

  get isClosed(): boolean {
    return this.closed
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    try {
      await this.beforeClose()
    } finally {
      await this.database.release()
    }
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    return this.perform(fetchCapability, this.local.fetch, [parseHttpUrl(url).href, options])
  }

  async serve(options: ServeOptions = {}): Promise<string> {
    return this.performLocally(serveCapability, this.local.serve, [options])
  }

  protected async beforeClose(): Promise<void> {}

  protected async updateClusterDocument(update: (document: ClusterDocument) => ClusterDocument): Promise<void> {
    const current = await readClusterDocument(this.database.database, this.datasetId)
    const updated = await writeClusterDocument(this.database.database, this.datasetId, update(current))
    this.clusterState = Cluster.fromDocument(updated)
  }

  private async perform<Args extends readonly unknown[], Result>(
    capability: Capability<Args, Result>,
    local: Implementation<Args, Result> | undefined,
    args: Args,
  ): Promise<Result> {
    if (this.closed) throw new CoreClosedError(this.datasetId)
    if (local !== undefined) return local(...args)
    return this.clusterState.forward(capability, args)
  }

  private async performLocally<Args extends readonly unknown[], Result>(
    capability: Capability<Args, Result>,
    local: Implementation<Args, Result> | undefined,
    args: Args,
  ): Promise<Result> {
    if (this.closed) throw new CoreClosedError(this.datasetId)
    if (local === undefined) throw new CapabilityUnavailableError(capability.id)
    return local(...args)
  }
}
