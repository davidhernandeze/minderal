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
  | { readonly t: 'request'; readonly id: string; readonly capability: string; readonly args: unknown }
  | { readonly t: 'cancel'; readonly id: string }

export interface Presence {
  readonly id: string
  /** ISO time the node came online. */
  readonly since: string
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
