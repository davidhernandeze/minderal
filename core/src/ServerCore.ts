import { fetchFromNodejs } from './capabilities/fetch/nodejs.js'
import type { LocalCapabilities } from './capabilities/LocalCapabilities.js'
import type { ServeOptions } from './capabilities/serve/contract.js'
import { withEndpoint } from './cluster/ClusterDocument.js'
import { Core, type CoreContext } from './Core.js'
import { serveDataset, type ServedDataset } from './server/serveDataset.js'

export class ServerCore extends Core {
  readonly runtime: 'nodejs' = 'nodejs'
  protected readonly local: LocalCapabilities = {
    fetch: fetchFromNodejs,
    serve: async (options) => this.startServing(options),
  }
  private serving: Promise<ServedDataset> | undefined

  private constructor(context: CoreContext) {
    super(context)
  }

  static create(context: CoreContext): ServerCore {
    return new ServerCore(context)
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

  private async startServing(options: ServeOptions): Promise<string> {
    this.serving ??= this.launch(options)
    try {
      return (await this.serving).url
    } catch (error) {
      this.serving = undefined
      throw error
    }
  }

  private async launch(options: ServeOptions): Promise<ServedDataset> {
    const served = await serveDataset(this.database.database, this.datasetId, options)
    try {
      await this.updateClusterDocument((document) => withEndpoint(document, this.nodeId, served.url))
    } catch (error) {
      await served.stop()
      throw error
    }
    return served
  }
}
