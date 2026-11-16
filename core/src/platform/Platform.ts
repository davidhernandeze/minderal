import type { NodeRole } from '../cluster/ClusterDocument.js'
import type { Core, CoreContext } from '../Core.js'
import type { Runtime } from '../Runtime.js'
import type { Credentials } from '../storage/DatabaseLocation.js'
import type { DatabasePool } from '../storage/DatabasePool.js'
import type { LocalEngine } from '../storage/StorageDescriptor.js'

export interface Platform {
  readonly runtime: Runtime
  readonly localEngine: LocalEngine
  readonly role: NodeRole
  readonly databases: DatabasePool
  defaultHome(): string
  defaultCredentials(): Credentials | undefined
  createCore(context: CoreContext): Core
}
