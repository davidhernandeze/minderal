import type { FetchImplementation } from './fetch/contract.js'

export interface LocalCapabilities {
  readonly fetch?: FetchImplementation
}
