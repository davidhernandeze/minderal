/**
 * A capability is something a core can do, defined once as a contract and implemented per runtime.
 *
 * The contract is immutable once published: its `id` (`<name>@<version>`) names exactly one shape of
 * arguments and result, on every node and in every core version. Implementations may change freely —
 * faster, other libraries — but what goes in and what comes out never does. A different shape is a new
 * capability with a new version, e.g. `fetch@2`, living next to `fetch@1`.
 *
 * `contract` describes that shape in words and is locked in `capabilities.lock.json`: changing the
 * description of a published id fails the test suite, as a reminder that the shape itself is frozen.
 */
export interface Capability<Args extends readonly unknown[], Result> {
  readonly id: string
  readonly name: string
  readonly version: number
  readonly contract: CapabilityContract
  /** How the capability crosses the network to another node; undefined for capabilities that only run locally. */
  readonly wire: Wire<Args, Result> | undefined
}

export interface CapabilityContract {
  readonly args: readonly string[]
  readonly result: string
}

/**
 * The wire format of a forwardable capability. Arguments travel as one JSON value. A result travels as a
 * JSON `head`, optionally followed by a stream of bytes (`body`), so large results stream instead of
 * buffering, and a result cut short can be told apart from a complete one.
 */
export interface Wire<Args extends readonly unknown[], Result> {
  encodeArgs(args: Args): unknown
  /** Validates and decodes arguments received from another node; throws TypeError on anything invalid. */
  decodeArgs(payload: unknown): Args
  encodeResult(result: Result): EncodedResult
  /**
   * Rebuilds the result. Reading `body` throws PartialResultError when the result is cut short, so a
   * capability whose result streams surfaces that error where its caller reads it.
   */
  decodeResult(head: unknown, body: AsyncIterable<Uint8Array>): Result | Promise<Result>
}

export interface EncodedResult {
  readonly head: unknown
  readonly body?: AsyncIterable<Uint8Array>
}

export type Implementation<Args extends readonly unknown[], Result> = (...args: Args) => Promise<Result>

/** Any capability, whatever its types — for catalogs and lookups. */
export type AnyCapability = Capability<any, any>

export interface CapabilityDefinition<Args extends readonly unknown[], Result> {
  readonly name: string
  readonly version: number
  readonly contract: CapabilityContract
  readonly wire?: Wire<Args, Result>
}

export function defineCapability<Args extends readonly unknown[], Result>(
  definition: CapabilityDefinition<Args, Result>,
): Capability<Args, Result> {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.name)) throw new TypeError(`Invalid capability name ${definition.name}`)
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    throw new TypeError(`Invalid version ${definition.version} for capability ${definition.name}`)
  }
  return Object.freeze({
    id: `${definition.name}@${definition.version}`,
    name: definition.name,
    version: definition.version,
    contract: Object.freeze({ args: Object.freeze([...definition.contract.args]), result: definition.contract.result }),
    wire: definition.wire,
  })
}
