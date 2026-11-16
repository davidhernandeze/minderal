import type { AnyCapability } from './Capability.js'

/**
 * Lets a core method stand for its capability, so callers can write `cluster.nodesWith(core.fetch)`:
 * the same function they call is the name of what they ask for. No strings involved.
 */
const byMethod = new WeakMap<object, AnyCapability>()

export function bindCapabilityMethod(method: object, capability: AnyCapability): void {
  byMethod.set(method, capability)
}

/** A capability object from `capabilities`, or a core method bound to one, such as `core.fetch`. */
export type CapabilityReference = AnyCapability | ((...args: never[]) => unknown)

export function resolveCapability(reference: CapabilityReference): AnyCapability {
  if (typeof reference !== 'function') return reference
  const capability = byMethod.get(reference)
  if (capability === undefined) throw new TypeError(`${reference.name || 'This function'} is not a capability of a core`)
  return capability
}
