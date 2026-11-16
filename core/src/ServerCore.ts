import type { ServeOptions } from './capabilities/serve/contract.js'
import { newNode, withAnnouncement, withNode, type NodeAnnouncement } from './cluster/ClusterDocument.js'
import { readClusterDocument } from './cluster/clusterStorage.js'
import { Core, type CoreContext } from './Core.js'
import { HttpError } from './server/http.js'
import type { EndpointHost } from './server/DatasetEndpoint.js'
import { serveDataset, type ServedDataset } from './server/serveDataset.js'

export class ServerCore extends Core {
  readonly runtime: 'nodejs' = 'nodejs'
  private serving: Promise<ServedDataset> | undefined
  private servedUrl: string | undefined

  private constructor(context: CoreContext) {
    super(context)
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

  private async launch(options: ServeOptions): Promise<ServedDataset> {
    const served = await serveDataset(this.database.database, this.datasetId, options, this.endpointHost(options.origins ?? []))
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

  private endpointHost(origins: readonly string[]): EndpointHost {
    return {
      origins,
      status: async () => readClusterDocument(this.database.database, this.datasetId),
      join: async (announcement) => this.admit(announcement),
      announce: async (nodeId, announcement) => this.record(nodeId, announcement),
      isMember: (nodeId) => this.cluster.nodes.some((node) => node.id === nodeId),
      invoke: (capabilityId) => {
        const entry = this.platform.capabilities.forwardable(capabilityId)
        if (entry === undefined || this.isClosed) return undefined
        return { capability: entry.capability, run: async (args) => entry.run(this, args) }
      },
    }
  }

  /** The orchestrator's side of joining: the orchestrator generates the newcomer's node id. */
  private async admit(announcement: NodeAnnouncement): Promise<{ nodeId: string; cluster: unknown }> {
    this.requireOrchestrator()
    const node = newNode(crypto.randomUUID(), 'member', announcement, new Date())
    const cluster = await this.changeClusterDocument((document) => withNode(document, node))
    return { nodeId: node.id, cluster }
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
