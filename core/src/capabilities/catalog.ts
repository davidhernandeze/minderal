import type { AnyCapability } from './Capability.js'
import { fetchCapability } from './fetch/contract.js'
import { serveCapability } from './serve/contract.js'

/**
 * Every capability the library defines, the public way to name one: `core.cluster.nodesWith(capabilities.fetch)`.
 * Ids are derived from these objects and only ever appear on the wire and in the cluster document.
 */
export const capabilities = Object.freeze({
  fetch: fetchCapability,
  serve: serveCapability,
})

export const allCapabilities: readonly AnyCapability[] = Object.values(capabilities)
