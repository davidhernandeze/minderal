import { describe, expect, it } from 'vitest'
import { defineCapability } from '../../src/capabilities/Capability.js'
import { Cluster } from '../../src/cluster/Cluster.js'
import { isClusterDocument, newClusterDocument } from '../../src/cluster/ClusterDocument.js'
import { CapabilityUnavailableError } from '../../src/errors.js'

const founder = { id: 'node-1', runtime: 'browser', role: 'member' } as const

describe('cluster document', () => {
  it('starts with the founding node and no endpoints', () => {
    expect(newClusterDocument('dataset-1', founder)).toEqual({
      _id: '_design/cluster',
      dataset: 'dataset-1',
      nodes: [founder],
      endpoints: [],
    })
  })

  it('recognizes a valid document', () => {
    expect(isClusterDocument({ ...newClusterDocument('dataset-1', founder), _rev: '1-a' })).toBe(true)
  })

  it.each([
    ['another id', { ...newClusterDocument('d', founder), _id: '_design/other' }],
    ['a missing dataset', { _id: '_design/cluster', nodes: [], endpoints: [] }],
    ['an unknown runtime', { ...newClusterDocument('d', founder), nodes: [{ ...founder, runtime: 'deno' }] }],
    ['an unknown role', { ...newClusterDocument('d', founder), nodes: [{ ...founder, role: 'leader' }] }],
    ['non-string endpoints', { ...newClusterDocument('d', founder), endpoints: [1] }],
    ['null', null],
  ])('rejects a document with %s', (_, document) => {
    expect(isClusterDocument(document)).toBe(false)
  })
})

describe('Cluster', () => {
  it('lists the nodes of its document', () => {
    expect(Cluster.fromDocument(newClusterDocument('dataset-1', founder)).nodes).toEqual([founder])
  })

  it('cannot perform a capability while it has no other nodes', async () => {
    const cluster = Cluster.fromDocument(newClusterDocument('dataset-1', founder))
    const capability = defineCapability<[number], number>('double')
    await expect(cluster.forward(capability, [2])).rejects.toThrow(CapabilityUnavailableError)
  })
})
