import type { CapabilitySet } from '../capabilities/CapabilitySet.js'
import type { NodeRole } from '../cluster/ClusterDocument.js'
import type { Core, CoreContext } from '../Core.js'
import type { Runtime } from '../Runtime.js'
import type { Credentials } from '../storage/DatabaseLocation.js'
import type { DatabasePool } from '../storage/DatabasePool.js'
import type { LocalEngine } from '../storage/StorageDescriptor.js'

/** What a node can say about where it runs, before the user names it. */
export interface NodeDescription {
  readonly defaultName: string
  readonly userAgent?: string
  readonly os?: string
}

export interface Platform {
  readonly runtime: Runtime
  readonly localEngine: LocalEngine
  /** The role of a core that founds a dataset on this runtime. */
  readonly role: NodeRole
  readonly databases: DatabasePool
  /** The capabilities cores on this runtime implement locally. */
  readonly capabilities: CapabilitySet<any>
  /** Opens another node's endpoint for replication, identifying this node to it. */
  openRemote(url: string, nodeId?: string): PouchDB.Database
  defaultHome(): string
  defaultCredentials(): Credentials | undefined
  describeNode(): NodeDescription
  createCore(context: CoreContext): Core
}
