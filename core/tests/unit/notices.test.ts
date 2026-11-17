import { afterEach, describe, expect, it } from 'vitest'
import { parseChangeNotice, type ChannelMessage } from '../../src/cluster/channel.js'
import { Cluster } from '../../src/cluster/Cluster.js'
import { newClusterDocument, newNode } from '../../src/cluster/ClusterDocument.js'
import { NoticeBatcher } from '../../src/cluster/NoticeBatcher.js'
import { RelayHub } from '../../src/cluster/RelayHub.js'
import { writtenChanges, type WrittenChange } from '../../src/database/couchApi.js'

describe('NoticeBatcher', () => {
  it('gathers a burst into one batch, a document written twice told once with its last state', async () => {
    const sent: WrittenChange[][] = []
    const batcher = new NoticeBatcher(async (changes) => void sent.push(changes), 20)
    batcher.add([{ id: 'a', deleted: false }])
    batcher.add([{ id: 'b', deleted: false }])
    batcher.add([{ id: 'a', deleted: true }])
    await expect.poll(() => sent).toHaveLength(1)
    expect(sent[0]).toEqual([
      { id: 'b', deleted: false },
      { id: 'a', deleted: true },
    ])
  })

  it('splits batches above the limit, in order', async () => {
    const sent: WrittenChange[][] = []
    const batcher = new NoticeBatcher(async (changes) => void sent.push(changes), 1000, 2)
    batcher.add(['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, deleted: false })))
    await batcher.flush()
    expect(sent.map((batch) => batch.map((change) => change.id))).toEqual([['a', 'b'], ['c', 'd'], ['e']])
  })

  it('keeps going after a failed send, and sends nothing once closed', async () => {
    const sent: string[] = []
    const batcher = new NoticeBatcher(async (changes) => {
      if (changes[0]?.id === 'fails') throw new Error('offline')
      sent.push(changes[0]?.id ?? '')
    }, 1000)
    batcher.add([{ id: 'fails', deleted: false }])
    await batcher.flush()
    batcher.add([{ id: 'works', deleted: false }])
    await batcher.flush()
    batcher.close()
    batcher.add([{ id: 'late', deleted: false }])
    await batcher.flush()
    expect(sent).toEqual(['works'])
  })
})

describe('writtenChanges', () => {
  const ok = { status: 201, json: { ok: true, id: 'generated', rev: '1-a' } }

  it('names documents written by PUT, DELETE, attachments and _bulk_docs', () => {
    expect(writtenChanges({ method: 'PUT', path: ['n1'], query: {}, body: { _id: 'n1' } }, ok)).toEqual([{ id: 'n1', deleted: false }])
    expect(writtenChanges({ method: 'PUT', path: ['n1'], query: {}, body: { _deleted: true } }, ok)).toEqual([{ id: 'n1', deleted: true }])
    expect(writtenChanges({ method: 'DELETE', path: ['n1'], query: { rev: '1-a' } }, ok)).toEqual([{ id: 'n1', deleted: true }])
    expect(writtenChanges({ method: 'PUT', path: ['n1', 'photo.png'], query: {} }, ok)).toEqual([{ id: 'n1', deleted: false }])
    expect(writtenChanges({ method: 'POST', path: [], query: {}, body: { title: 'x' } }, ok)).toEqual([{ id: 'generated', deleted: false }])
    expect(
      writtenChanges(
        { method: 'POST', path: ['_bulk_docs'], query: {}, body: { docs: [{ _id: 'a' }, { _id: 'b', _deleted: true }, { _id: '_design/cluster' }, 'junk'] } },
        ok,
      ),
    ).toEqual([
      { id: 'a', deleted: false },
      { id: 'b', deleted: true },
    ])
  })

  it('names nothing for reads, refused writes and system documents', () => {
    expect(writtenChanges({ method: 'GET', path: ['n1'], query: {} }, { status: 200 })).toEqual([])
    expect(writtenChanges({ method: 'POST', path: ['_revs_diff'], query: {}, body: {} }, { status: 200 })).toEqual([])
    expect(writtenChanges({ method: 'PUT', path: ['n1'], query: {}, body: {} }, { status: 409 })).toEqual([])
    expect(writtenChanges({ method: 'PUT', path: ['_local', 'checkpoint'], query: {}, body: {} }, ok)).toEqual([])
  })
})

describe('parseChangeNotice', () => {
  it('accepts a notice and keeps only its fields', () => {
    expect(parseChangeNotice({ t: 'changed', node: 'n', seq: 4, changes: [{ id: 'a', deleted: false, extra: 1 }] })).toEqual({
      node: 'n',
      seq: 4,
      changes: [{ id: 'a', deleted: false }],
    })
    expect(parseChangeNotice({ node: 'n', seq: '12-g1AAA', changes: [] })).toEqual({ node: 'n', seq: '12-g1AAA', changes: [] })
  })

  it('rejects anything else', () => {
    for (const value of [null, {}, { node: '', seq: 1, changes: [] }, { node: 'n', seq: '', changes: [] }, { node: 'n', seq: 1, changes: [{ id: 1 }] }]) {
      expect(parseChangeNotice(value)).toBeUndefined()
    }
  })
})

describe('seqs in presence', () => {
  const hubs: RelayHub[] = []
  afterEach(() => hubs.splice(0).forEach((hub) => hub.close()))

  it('the hub records where each member is and when it last moved', () => {
    const hub = new RelayHub({ heartbeatMs: 1000, leaseMs: 5000 }, () => undefined)
    hubs.push(hub)
    const messages: ChannelMessage[] = []
    hub.connect('m', { send: (message) => messages.push(message), close: () => undefined })
    expect(hub.presence()[0]).not.toHaveProperty('seq')
    expect(hub.progress('m', 3)).toBe(true)
    expect(hub.progress('m', 3)).toBe(false)
    expect(hub.progress('elsewhere', 3)).toBe(false)
    expect(hub.presence()[0]).toMatchObject({ id: 'm', seq: 3, changedAt: expect.any(String) })

    hub.broadcast({ t: 'ping' }, 'm')
    expect(messages.filter((message) => message.t === 'ping')).toHaveLength(0)
  })

  it('the cluster view tells seqs of online nodes and its own', () => {
    const cluster = new Cluster(newClusterDocument('d', newNode('self', 'orchestrator', { name: 'self', runtime: 'nodejs', coreVersion: '0.0.0', capabilities: [] }, new Date())), 'self')
    const heard: number[] = []
    cluster.subscribe(() => heard.push(1))
    expect(cluster.seqOf('self')).toBeUndefined()
    cluster.setOwnSeq(7, undefined)
    expect(cluster.seqOf('self')).toEqual({ seq: 7, changedAt: undefined })

    cluster.setPresence([{ id: 'other', since: 't0', seq: 2, changedAt: 't1' }])
    expect(cluster.seqOf('other')).toEqual({ seq: 2, changedAt: 't1' })
    cluster.noteSeq('other', 5)
    expect(cluster.seqOf('other')).toMatchObject({ seq: 5, changedAt: expect.any(String) })
    cluster.setPresence([])
    expect(cluster.seqOf('other')).toBeUndefined()
    expect(heard.length).toBe(4)
  })
})
