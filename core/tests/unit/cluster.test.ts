import { describe, expect, it } from 'vitest'
import { fetchCapability } from '../../src/capabilities/fetch/contract.js'
import { Cluster } from '../../src/cluster/Cluster.js'
import {
  announcementChanges,
  isClusterDocument,
  newClusterDocument,
  newNode,
  parseAnnouncement,
  withAnnouncement,
  withNode,
  type NodeAnnouncement,
} from '../../src/cluster/ClusterDocument.js'
import { CapabilityUnavailableError } from '../../src/errors.js'

const now = new Date('2026-11-16T10:00:00Z')
const later = new Date('2026-11-16T11:00:00Z')
const browser: NodeAnnouncement = { name: 'Chrome on macOS', runtime: 'browser', coreVersion: '0.0.0', capabilities: [], userAgent: 'UA' }
const server: NodeAnnouncement = { name: 'desk', runtime: 'nodejs', coreVersion: '0.0.0', capabilities: ['fetch@1', 'serve@1'] }
const founder = newNode('node-1', 'orchestrator', server, now)

describe('cluster document', () => {
  it('starts with the founding node only', () => {
    expect(newClusterDocument('dataset-1', founder)).toEqual({ _id: '_design/cluster', dataset: 'dataset-1', nodes: [founder] })
    expect(founder).toMatchObject({ id: 'node-1', role: 'orchestrator', joinedAt: now.toISOString(), announcedAt: now.toISOString() })
  })

  it('adds a node, replacing one with the same id', () => {
    const member = newNode('node-2', 'member', browser, now)
    const document = withNode(withNode(newClusterDocument('d', founder), member), { ...member, name: 'renamed' })
    expect(document.nodes.map((node) => [node.id, node.name])).toEqual([
      ['node-1', 'desk'],
      ['node-2', 'renamed'],
    ])
  })

  it('applies an announcement, keeping identity, role, join time and a known endpoint', () => {
    const document = withNode(newClusterDocument('d', founder), { ...newNode('node-2', 'member', browser, now), endpoint: 'http://a/x' })
    const updated = withAnnouncement(document, 'node-2', { ...browser, name: 'Phone', coreVersion: '0.1.0' }, later)
    expect(updated.nodes[1]).toEqual({
      ...browser,
      name: 'Phone',
      coreVersion: '0.1.0',
      endpoint: 'http://a/x',
      id: 'node-2',
      role: 'member',
      joinedAt: now.toISOString(),
      announcedAt: later.toISOString(),
    })
    expect(updated.nodes[0]).toBe(document.nodes[0])
  })

  it('tells whether an announcement changes anything', () => {
    expect(announcementChanges(founder, server)).toBe(false)
    expect(announcementChanges(founder, { ...server, capabilities: ['serve@1', 'fetch@1'] })).toBe(false)
    expect(announcementChanges(founder, { ...server, capabilities: ['fetch@1'] })).toBe(true)
    expect(announcementChanges(founder, { ...server, coreVersion: '0.1.0' })).toBe(true)
    expect(announcementChanges(founder, { ...server, endpoint: 'http://a/x' })).toBe(true)
  })

  it('parses an announcement from another node, normalizing capabilities', () => {
    expect(parseAnnouncement({ ...server, name: '  desk ', capabilities: ['serve@1', 'fetch@1', 'fetch@1'], extra: 1 })).toEqual(server)
  })

  it.each([
    ['no name', { ...server, name: ' ' }],
    ['an unknown runtime', { ...server, runtime: 'deno' }],
    ['a capability that is not an id', { ...server, capabilities: ['fetch'] }],
    ['a non-http endpoint', { ...server, endpoint: 'file:///x' }],
    ['a non-string user agent', { ...server, userAgent: 1 }],
  ])('rejects an announcement with %s', (_, value) => {
    expect(() => parseAnnouncement(value)).toThrow(TypeError)
  })

  it('recognizes a valid document', () => {
    expect(isClusterDocument({ ...newClusterDocument('dataset-1', founder), _rev: '1-a' })).toBe(true)
  })

  it.each([
    ['another id', { ...newClusterDocument('d', founder), _id: '_design/other' }],
    ['a missing dataset', { _id: '_design/cluster', nodes: [] }],
    ['an unknown role', { ...newClusterDocument('d', founder), nodes: [{ ...founder, role: 'leader' }] }],
    ['a node without core version', { ...newClusterDocument('d', founder), nodes: [{ ...founder, coreVersion: undefined }] }],
    ['a node without capabilities', { ...newClusterDocument('d', founder), nodes: [{ ...founder, capabilities: undefined }] }],
    ['a non-string endpoint', { ...newClusterDocument('d', founder), nodes: [{ ...founder, endpoint: 1 }] }],
    ['null', null],
  ])('rejects a document with %s', (_, document) => {
    expect(isClusterDocument(document)).toBe(false)
  })
})

describe('Cluster', () => {
  it('knows itself, its orchestrator and who can do what', () => {
    const member = newNode('node-2', 'member', browser, now)
    const cluster = new Cluster(withNode(newClusterDocument('d', founder), member), 'node-2')
    expect(cluster.self).toEqual(member)
    expect(cluster.orchestrator).toEqual(founder)
    expect(cluster.nodesWith(fetchCapability)).toEqual([founder])
  })

  it('only adopts newer revisions, and notifies subscribers when it does', () => {
    const cluster = new Cluster({ ...newClusterDocument('d', founder), _rev: '2-b' }, 'node-1')
    let notified = 0
    cluster.subscribe(() => (notified += 1))
    expect(cluster.update({ ...newClusterDocument('d', founder), _rev: '1-a' })).toBe(false)
    expect(cluster.update({ ...newClusterDocument('d', founder), _rev: '3-c' })).toBe(true)
    expect(notified).toBe(1)
  })

  it('cannot forward while no other node announces the capability with an endpoint', async () => {
    const cluster = new Cluster(newClusterDocument('d', founder), 'node-2')
    await expect(cluster.forward(fetchCapability, ['http://x/', {}])).rejects.toThrow(CapabilityUnavailableError)
  })
})
