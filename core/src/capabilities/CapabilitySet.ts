import type { AnyCapability, Capability } from './Capability.js'

/**
 * Whether a capability can run on this node right now. Runtime alone does not decide everything: a
 * browser may have a camera but no permission to use it, a server may have a media store attached or
 * not. A probe answers for the node's current setup; capabilities without one are always available.
 */
export type AvailabilityProbe = () => Promise<boolean>

/** A local implementation, given the core it runs for. */
export type HostedImplementation<Host, Args extends readonly unknown[], Result> = (host: Host, ...args: Args) => Promise<Result>

type AnyImplementation = (host: never, ...args: never[]) => Promise<unknown>

interface Entry {
  readonly capability: AnyCapability
  readonly implementation: AnyImplementation
  readonly available: AvailabilityProbe | undefined
}

export interface ForwardableEntry<Host> {
  readonly capability: AnyCapability
  readonly run: (host: Host, args: readonly unknown[]) => Promise<unknown>
}

/**
 * The capabilities a kind of core implements locally, keyed by capability objects — never by strings.
 * A platform builds one set per runtime; the type checker holds each implementation to its contract.
 */
export class CapabilitySet<Host> {
  private readonly entries: Map<string, Entry>

  constructor() {
    this.entries = new Map()
  }

  with<Args extends readonly unknown[], Result>(
    capability: Capability<Args, Result>,
    implementation: NoInfer<HostedImplementation<Host, Args, Result>>,
    available?: AvailabilityProbe,
  ): this {
    if (this.entries.has(capability.id)) throw new Error(`${capability.id} is implemented twice`)
    this.entries.set(capability.id, { capability, implementation: implementation as unknown as AnyImplementation, available })
    return this
  }

  get<Args extends readonly unknown[], Result>(capability: Capability<Args, Result>): HostedImplementation<Host, Args, Result> | undefined {
    return this.entries.get(capability.id)?.implementation as HostedImplementation<Host, Args, Result> | undefined
  }

  /** Looks up a capability by the id another node sent, if this node may perform it on that node's behalf. */
  forwardable(id: string): ForwardableEntry<Host> | undefined {
    const entry = this.entries.get(id)
    if (entry === undefined || entry.capability.wire === undefined) return undefined
    const implementation = entry.implementation as unknown as (host: Host, ...args: readonly unknown[]) => Promise<unknown>
    return { capability: entry.capability, run: async (host, args) => implementation(host, ...args) }
  }

  /** The ids this node announces to its cluster: every capability whose probe says it is available now. */
  async availableIds(): Promise<string[]> {
    const ids: string[] = []
    for (const entry of this.entries.values()) {
      if (entry.available === undefined || (await safely(entry.available))) ids.push(entry.capability.id)
    }
    return ids.sort()
  }
}

async function safely(probe: AvailabilityProbe): Promise<boolean> {
  try {
    return await probe()
  } catch {
    return false
  }
}
