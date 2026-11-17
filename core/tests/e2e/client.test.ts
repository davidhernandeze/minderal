import { CapabilityUnavailableError, capabilities, DocumentConflictError, openDataset } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, freshHome, joinTracked, track } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const runtime = inject('runtime')
const quickly = { timeout: 8000 }
const clientMode = { storage: { engine: 'none' } } as const

describe('client mode: a core without a copy of the dataset', () => {
  it('joins without copying anything and does not announce the data', async () => {
    const cluster = await HarnessCluster.start()
    await cluster.put('note:1', { title: 'Stays on the orchestrator' })
    const core = await joinTracked(cluster.endpoint, clientMode)

    expect(core.holdsData).toBe(false)
    expect(core.role).toBe('member')
    expect(core.cluster.self?.capabilities).not.toContain(capabilities.database.id)
    expect(await core.sync()).toEqual({ pushed: 0, pulled: 0 })
    await expect.poll(async () => cluster.online(), quickly).toContain(core.nodeId)
  })

  it('reads and writes through the cluster', async () => {
    const cluster = await HarnessCluster.start()
    await cluster.put('note:1', { title: 'From the orchestrator' })
    const core = await joinTracked(cluster.endpoint, clientMode)

    expect(await core.documents.get('note:1')).toMatchObject({ title: 'From the orchestrator' })
    const { rev } = await core.documents.put({ _id: 'note:2', title: 'From the client' })
    expect(await cluster.get('note:2')).toMatchObject({ _rev: rev, title: 'From the client' })
    expect(await core.documents.get('note:2')).toMatchObject({ _rev: rev })
    expect(await core.documents.get('missing')).toBeUndefined()
  })

  it('lists, removes, and reports conflicts like a local copy', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint, clientMode)
    const first = await core.documents.put({ _id: 'b', n: 2 })
    await core.documents.put({ _id: 'a', n: 1 })
    expect((await core.documents.list()).map((document) => document._id)).toEqual(['a', 'b'])

    await core.documents.put({ _id: 'b', _rev: first.rev, n: 3 })
    await expect(core.documents.put({ _id: 'b', _rev: first.rev, n: 4 })).rejects.toThrow(DocumentConflictError)

    const current = await core.documents.get('b')
    await core.documents.remove('b', current!._rev)
    expect(await core.documents.get('b')).toBeUndefined()
    expect((await core.documents.list()).map((document) => document._id)).toEqual(['a'])
  })

  it('tells watchers about changes made anywhere', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint, clientMode)
    const seen: string[] = []
    const stop = core.documents.watch((change) => seen.push(change.id))
    await new Promise((resolve) => setTimeout(resolve, 300))
    await cluster.put('note:1', { title: 'Written elsewhere' })
    await expect.poll(() => seen, quickly).toContain('note:1')
    stop()
  })

  it('reads data held by members when the orchestrator holds none', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const holder = await joinTracked(cluster.endpoint)
    await holder.documents.put({ _id: 'note:1', title: 'Held by a member' })
    await expect.poll(async () => cluster.online(), quickly).toContain(holder.nodeId)

    const client = await joinTracked(cluster.endpoint, clientMode)
    await expect.poll(() => client.cluster.isOnline(holder.nodeId), quickly).toBe(true)
    expect(await client.documents.get('note:1')).toMatchObject({ title: 'Held by a member' })
    await client.documents.put({ _id: 'note:2', title: 'Written by the client' })
    expect(await holder.documents.get('note:2')).toMatchObject({ title: 'Written by the client' })
  })

  it('throws CapabilityUnavailableError while no node holding the data can be reached, and recovers', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint, clientMode)
    await cluster.stop()
    await expect(core.documents.get('note:1')).rejects.toThrow(CapabilityUnavailableError)

    await cluster.restart()
    await cluster.put('note:1', { title: 'Back' })
    await expect.poll(async () => core.documents.get('note:1').catch(() => undefined), quickly).toMatchObject({ title: 'Back' })
  })

  it('reopens without the cluster being reachable, and stays a client', async () => {
    const cluster = await HarnessCluster.start()
    const home = freshHome()
    const joined = await joinTracked(cluster.endpoint, { home, ...clientMode })
    await joined.close()
    await cluster.stop()

    const reopened = track(await openDataset(joined.datasetId, { home }))
    expect(reopened.holdsData).toBe(false)
    await expect(reopened.documents.list()).rejects.toThrow(CapabilityUnavailableError)
  })
})

describe.runIf(runtime === 'nodejs')("an orchestrator without data, using its members' data", () => {
  it('reads and writes documents through a member holding them', async () => {
    const orchestrator = await createTracked({ storage: { engine: 'none' }, presence: { heartbeatMs: 200, leaseMs: 1000 } })
    const endpoint = await orchestrator.serve()
    await expect(orchestrator.documents.list()).rejects.toThrow(CapabilityUnavailableError)

    const holder = await joinTracked(endpoint)
    await holder.documents.put({ _id: 'note:1', title: 'On the member' })
    await expect.poll(() => orchestrator.cluster.isOnline(holder.nodeId), quickly).toBe(true)

    expect(await orchestrator.documents.get('note:1')).toMatchObject({ title: 'On the member' })
    await orchestrator.documents.put({ _id: 'note:2', title: 'From the orchestrator' })
    expect(await holder.documents.get('note:2')).toMatchObject({ title: 'From the orchestrator' })
  })
})
