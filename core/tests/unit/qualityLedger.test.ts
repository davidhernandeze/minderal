import { describe, expect, it } from 'vitest'
import { newNode, type ClusterNode } from '../../src/cluster/ClusterDocument.js'
import { FAILURE_COOLDOWN_MS, QualityLedger } from '../../src/cluster/QualityLedger.js'

const at = new Date('2026-11-16T10:00:00Z')
function node(id: string, role: 'orchestrator' | 'member' = 'member'): ClusterNode {
  return newNode(id, role, { name: id, runtime: 'nodejs', coreVersion: '0.0.0', capabilities: ['fetch@1'] }, at)
}

describe('QualityLedger', () => {
  it('averages latency over successes and counts outcomes', () => {
    const ledger = new QualityLedger()
    ledger.recordSuccess('a', 100, 1)
    ledger.recordSuccess('a', 200, 2)
    ledger.recordFailure('a', 'is unreachable', 3)
    expect(ledger.get('a')).toEqual({
      latencyMs: 130,
      successes: 2,
      failures: 1,
      lastSuccessAt: 2,
      lastFailureAt: 3,
      lastFailure: 'is unreachable',
    })
  })

  it('ranks fast healthy nodes first, then unmeasured ones, then recently failed ones', () => {
    const ledger = new QualityLedger()
    const now = 1_000_000
    ledger.recordSuccess('slow', 300, now - 10)
    ledger.recordSuccess('fast', 20, now - 10)
    ledger.recordFailure('down', 'is unreachable', now - 5)
    const ranked = ledger.rank([node('down'), node('new'), node('slow'), node('fast')], now)
    expect(ranked.map(({ id }) => id)).toEqual(['fast', 'slow', 'new', 'down'])
  })

  it('gives a failed node another chance after the cooldown or once it succeeds again', () => {
    const ledger = new QualityLedger()
    ledger.recordSuccess('a', 50, 0)
    ledger.recordFailure('a', 'is unreachable', 10)
    ledger.recordSuccess('b', 100, 10)
    expect(ledger.rank([node('a'), node('b')], 20).map(({ id }) => id)).toEqual(['b', 'a'])
    expect(ledger.rank([node('a'), node('b')], 10 + FAILURE_COOLDOWN_MS).map(({ id }) => id)).toEqual(['a', 'b'])
    ledger.recordSuccess('a', 50, 30)
    expect(ledger.rank([node('a'), node('b')], 40).map(({ id }) => id)).toEqual(['a', 'b'])
  })

  it('breaks ties in favor of the orchestrator', () => {
    const ranked = new QualityLedger().rank([node('m1'), node('o', 'orchestrator'), node('m0')])
    expect(ranked.map(({ id }) => id)).toEqual(['o', 'm0', 'm1'])
  })

  it('notifies on every recorded outcome', () => {
    let changes = 0
    const ledger = new QualityLedger(() => (changes += 1))
    ledger.recordSuccess('a', 1)
    ledger.recordFailure('a', 'x')
    expect(changes).toBe(2)
  })
})

describe('QualityLedger without a latency', () => {
  it('counts a success that says nothing about latency, such as a long-poll, without moving the average', () => {
    const ledger = new QualityLedger()
    ledger.recordSuccess('a', 40, 1)
    ledger.recordSuccess('a', undefined, 2)
    expect(ledger.get('a')).toMatchObject({ latencyMs: 40, successes: 2 })
  })
})
