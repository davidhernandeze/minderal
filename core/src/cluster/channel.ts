import type { Frame } from './frames.js'

/**
 * Messages an orchestrator sends down a member's channel: a long-lived NDJSON response the member keeps
 * open. The channel is how a node that cannot accept connections — a browser — is reached: presence,
 * cluster changes and relayed requests all come down it. The member answers over plain POSTs.
 */
export type ChannelMessage =
  | { readonly t: 'welcome'; readonly heartbeatMs: number; readonly leaseMs: number }
  | { readonly t: 'ping' }
  | { readonly t: 'cluster'; readonly document: unknown }
  | { readonly t: 'presence'; readonly online: readonly Presence[] }
  | ({ readonly t: 'changed' } & ChangeNotice)
  | { readonly t: 'request'; readonly id: string; readonly capability: string; readonly args: unknown }
  | { readonly t: 'cancel'; readonly id: string }

export interface Presence {
  readonly id: string
  /** ISO time the node came online. */
  readonly since: string
  /** The node's changes feed position, for nodes holding a copy: it goes up with every change to their copy. */
  readonly seq?: Seq
  /** ISO time the orchestrator last saw `seq` move. */
  readonly changedAt?: string
}

/**
 * A position in one node's changes feed. Only comparable with positions of the same node: each copy
 * counts its own changes, pulled-in ones included.
 */
export type Seq = string | number

/**
 * "Node X's copy changed: these documents, and its changes feed is now at `seq`." Sent by the node
 * that applied the writes — never by one relaying them — so each write is told once. A notice without
 * changes says only where the node is, so others can catch up from it.
 */
export interface ChangeNotice {
  readonly node: string
  readonly seq: Seq
  readonly changes: readonly { readonly id: string; readonly deleted: boolean }[]
}

export interface PresenceTiming {
  /** How often members renew their lease and the orchestrator pings them. */
  readonly heartbeatMs: number
  /** How long a member stays online without renewing. */
  readonly leaseMs: number
}

export const DEFAULT_PRESENCE: PresenceTiming = { heartbeatMs: 10_000, leaseMs: 30_000 }

export interface ReplyBody {
  readonly node: string
  readonly request: string
  readonly frames: readonly Frame[]
}

export function parseChannelMessage(line: string): ChannelMessage | undefined {
  const value: unknown = JSON.parse(line)
  if (typeof value !== 'object' || value === null || !('t' in value)) return undefined
  return value as ChannelMessage
}

export function isPresenceList(value: unknown): value is Presence[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'object' && entry !== null && typeof entry.id === 'string' && typeof entry.since === 'string')
  )
}

export function isSeq(value: unknown): value is Seq {
  return (typeof value === 'string' && value !== '') || (typeof value === 'number' && Number.isFinite(value))
}

/** Validates a notice received from another node; undefined when it is not one. */
export function parseChangeNotice(value: unknown): ChangeNotice | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { node, seq, changes } = value as Record<string, unknown>
  if (typeof node !== 'string' || node === '' || !isSeq(seq) || !Array.isArray(changes)) return undefined
  const valid = changes.every(
    (change: unknown) =>
      typeof change === 'object' &&
      change !== null &&
      typeof (change as { id?: unknown }).id === 'string' &&
      typeof (change as { deleted?: unknown }).deleted === 'boolean',
  )
  if (!valid) return undefined
  return { node, seq, changes: changes.map((change: { id: string; deleted: boolean }) => ({ id: change.id, deleted: change.deleted })) }
}
