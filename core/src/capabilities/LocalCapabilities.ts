import type { FetchImplementation } from './fetch/contract.js'
import type { ServeImplementation } from './serve/contract.js'

export interface LocalCapabilities {
  readonly fetch?: FetchImplementation
  readonly serve?: ServeImplementation
}
