import { CapabilityUnavailableError, capabilities, createDataset } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, freshHome, joinTracked } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const runtime = inject('runtime')
const quickly = { timeout: 8000 }

describe('an orchestrator without a copy of its dataset', () => {
  it.runIf(runtime === 'nodejs')('keeps only the cluster document and does not announce the data', async () => {
    const core = await createTracked({ storage: { engine: 'none' } })
    expect(core.holdsData).toBe(false)
    expect(core.role).toBe('orchestrator')
    expect(core.cluster.self?.capabilities).not.toContain(capabilities.database.id)
    expect(core.cluster.nodesWith(capabilities.database)).toEqual([])
    // no member holding the data is connected yet
    await expect(core.documents.list()).rejects.toThrow(CapabilityUnavailableError)
  })

  it.runIf(runtime === 'browser')('cannot be a browser', async () => {
    await expect(createDataset({ home: freshHome(), storage: { engine: 'none' } })).rejects.toThrow(TypeError)
  })

  it('admits the first member with nothing to copy, and cannot sync it with anyone yet', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    expect((await cluster.status()).holdsData).toBe(false)
    const first = await joinTracked(cluster.endpoint)
    expect(first.holdsData).toBe(true)
    expect(first.cluster.orchestrator?.id).toBe(cluster.nodeId)
    await first.documents.put({ _id: 'note:1', title: 'Only here' })
    await expect(first.sync()).rejects.toThrow(CapabilityUnavailableError)
  })

  it("serves a joining member from another member's data, relayed through the orchestrator", async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const first = await joinTracked(cluster.endpoint)
    await first.documents.put({ _id: 'note:1', title: 'Written by the first member' })
    await expect.poll(async () => cluster.online(), quickly).toContain(first.nodeId)

    const second = await joinTracked(cluster.endpoint)
    expect(await second.documents.get('note:1')).toMatchObject({ title: 'Written by the first member' })

    await second.documents.put({ _id: 'note:2', title: 'Written by the second member' })
    await second.sync()
    expect(await first.documents.get('note:2')).toMatchObject({ title: 'Written by the second member' })
  })

  it('keeps members in sync live through the orchestrator', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const first = await joinTracked(cluster.endpoint)
    const second = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, first.nodeId, second.nodeId].sort())

    await first.documents.put({ _id: 'live:1', from: 'first' })
    await expect.poll(async () => second.documents.get('live:1'), quickly).toMatchObject({ from: 'first' })
    await second.documents.put({ _id: 'live:2', from: 'second' })
    await expect.poll(async () => first.documents.get('live:2'), quickly).toMatchObject({ from: 'second' })
  })

  it('lets members on different runtimes share data, Node.js and this one', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const server = await cluster.addMember({ name: 'Desk' })
    const core = await joinTracked(cluster.endpoint)
    await core.documents.put({ _id: 'note:1', title: 'From here' })
    await core.sync()
    expect(await cluster.memberGet(server.nodeId, 'note:1')).toMatchObject({ title: 'From here' })
  })

  it('reports the data unavailable while no other member holding it is online', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const first = await joinTracked(cluster.endpoint)
    const second = await joinTracked(cluster.endpoint)
    await second.sync()
    await first.close()
    await expect.poll(async () => cluster.online(), quickly).not.toContain(first.nodeId)

    await second.documents.put({ _id: 'note:1', title: 'Waits for a peer' })
    await expect(second.sync()).rejects.toThrow(CapabilityUnavailableError)
    expect(await second.documents.get('note:1')).toMatchObject({ title: 'Waits for a peer' })
  })
})
