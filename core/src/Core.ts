import type { Capability, Implementation } from './capabilities/Capability.js'
import { fetchCapability, parseHttpUrl, type FetchOptions } from './capabilities/fetch/contract.js'
import type { LocalCapabilities } from './capabilities/LocalCapabilities.js'
import type { Cluster, ClusterView } from './cluster/Cluster.js'
import { CoreClosedError } from './errors.js'
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
  private readonly database: DatabaseHandle
  private readonly clusterState: Cluster
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
    await this.database.release()
  }

  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    return this.perform(fetchCapability, this.local.fetch, [parseHttpUrl(url).href, options])
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
}
