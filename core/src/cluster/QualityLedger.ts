import type { ClusterNode } from './ClusterDocument.js'

/** What this core has observed about its link to another node. Kept in memory, per core. */
export interface LinkQuality {
  /** Moving average of round trips that succeeded, in milliseconds; undefined until one has. */
  readonly latencyMs: number | undefined
  readonly successes: number
  readonly failures: number
  readonly lastSuccessAt: number | undefined
  readonly lastFailureAt: number | undefined
  readonly lastFailure: string | undefined
}

/** How long a node that just failed goes to the back of the line. */
export const FAILURE_COOLDOWN_MS = 30_000
const SMOOTHING = 0.3

/**
 * Quality of service between this core and the other nodes, measured on real traffic: every delegated
 * request, join and announcement records its outcome. Delegation ranks candidates with it, so requests go
 * to the node that answers fastest and away from nodes that just failed.
 *
 * Version 0: local observations only. Next, nodes can share their measurements through the cluster so a
 * newcomer starts informed, and add throughput and load next to latency.
 */
export class QualityLedger {
  private readonly links: Map<string, LinkQuality>
  private readonly onChange: () => void

  constructor(onChange: () => void = () => undefined) {
    this.links = new Map()
    this.onChange = onChange
  }

  get(nodeId: string): LinkQuality | undefined {
    return this.links.get(nodeId)
  }

  /** A request the node answered; `latencyMs` undefined when its time says nothing about the link, like a long-poll's. */
  recordSuccess(nodeId: string, latencyMs: number | undefined, now: number = Date.now()): void {
    const link = this.links.get(nodeId) ?? empty()
    this.links.set(nodeId, {
      ...link,
      latencyMs:
        latencyMs === undefined
          ? link.latencyMs
          : link.latencyMs === undefined
            ? latencyMs
            : link.latencyMs * (1 - SMOOTHING) + latencyMs * SMOOTHING,
      successes: link.successes + 1,
      lastSuccessAt: now,
    })
    this.onChange()
  }

  recordFailure(nodeId: string, reason: string, now: number = Date.now()): void {
    const link = this.links.get(nodeId) ?? empty()
    this.links.set(nodeId, { ...link, failures: link.failures + 1, lastFailureAt: now, lastFailure: reason })
    this.onChange()
  }

  /**
   * Orders candidates for a request: healthy nodes by measured latency, then nodes never measured, then
   * nodes that failed within the cooldown, least recent failure first. Ties go to the orchestrator.
   */
  rank(candidates: readonly ClusterNode[], now: number = Date.now()): ClusterNode[] {
    return [...candidates].sort((a, b) => {
      const left = this.standing(a, now)
      const right = this.standing(b, now)
      return (
        left.tier - right.tier ||
        left.key - right.key ||
        Number(b.role === 'orchestrator') - Number(a.role === 'orchestrator') ||
        a.id.localeCompare(b.id)
      )
    })
  }

  private standing(node: ClusterNode, now: number): { tier: number; key: number } {
    const link = this.links.get(node.id)
    if (link === undefined) return { tier: 1, key: 0 }
    const failedRecently =
      link.lastFailureAt !== undefined &&
      now - link.lastFailureAt < FAILURE_COOLDOWN_MS &&
      (link.lastSuccessAt === undefined || link.lastFailureAt > link.lastSuccessAt)
    if (failedRecently) return { tier: 2, key: link.lastFailureAt ?? 0 }
    if (link.latencyMs === undefined) return { tier: 1, key: 0 }
    return { tier: 0, key: link.latencyMs }
  }
}

function empty(): LinkQuality {
  return {
    latencyMs: undefined,
    successes: 0,
    failures: 0,
    lastSuccessAt: undefined,
    lastFailureAt: undefined,
    lastFailure: undefined,
  }
}
