import { openDataset, type Core, type DocumentChange } from '@minderal/core'
import { describe, expect, it } from 'vitest'
import { freshHome, joinTracked, track } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

/**
 * Members pull on their own every 30 heartbeats — 6 s in the harness — whether or not a notice came.
 * Waiting well under that shows a change arrived because it was told, not because of that fallback.
 */
const told = { timeout: 2500, interval: 50 }
const quickly = { timeout: 8000 }

function collect(core: Core): DocumentChange[] {
  const seen: DocumentChange[] = []
  core.dataset.watch((change) => seen.push(change))
  return seen
}

async function settle(ms = 600): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

describe('changes told over channels, with the orchestrator holding the data', () => {
  it('reaches other members as soon as one writes, both ways', async () => {
    const cluster = await HarnessCluster.start()
    const first = await joinTracked(cluster.endpoint)
    const second = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, first.nodeId, second.nodeId].sort())

    await first.dataset.put({ _id: 'neuron:1', from: 'first' })
    await expect.poll(async () => second.dataset.get('neuron:1'), told).toMatchObject({ from: 'first' })
    await second.dataset.put({ _id: 'neuron:2', from: 'second' })
    await expect.poll(async () => first.dataset.get('neuron:2'), told).toMatchObject({ from: 'second' })
  })

  it("reaches members when the orchestrator writes, and wakes their watchers", async () => {
    const cluster = await HarnessCluster.start()
    const member = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toContain(member.nodeId)
    const seen = collect(member)
    await settle()

    await cluster.put('neuron:1', { title: 'From the orchestrator' })
    await expect.poll(() => seen.map((change) => change.id), told).toContain('neuron:1')
    expect(await member.dataset.get('neuron:1')).toMatchObject({ title: 'From the orchestrator' })
  })

  it('shows where each copy is, moving as it changes', async () => {
    const cluster = await HarnessCluster.start()
    const first = await joinTracked(cluster.endpoint)
    const second = await joinTracked(cluster.endpoint)
    await expect.poll(() => second.cluster.seqOf(first.nodeId), quickly).toBeDefined()
    expect(second.cluster.seqOf(cluster.nodeId)).toBeDefined()
    const before = first.cluster.seqOf(first.nodeId)?.seq

    await first.dataset.put({ _id: 'neuron:1' })
    await expect.poll(() => first.cluster.seqOf(first.nodeId)?.seq, told).not.toEqual(before)
    await expect.poll(() => second.cluster.seqOf(first.nodeId)?.seq, told).toEqual(first.cluster.seqOf(first.nodeId)?.seq)
    expect(second.cluster.seqOf(first.nodeId)?.changedAt).toEqual(expect.any(String))
  })

  it('tells a client-mode watcher what changed while its channel was down', async () => {
    const cluster = await HarnessCluster.start()
    const client = await joinTracked(cluster.endpoint, { storage: { engine: 'none' } })
    await expect.poll(async () => cluster.online(), quickly).toContain(client.nodeId)
    const seen = collect(client)
    await cluster.put('neuron:1', { title: 'Before' })
    await expect.poll(() => seen.map((change) => change.id), told).toContain('neuron:1')

    await cluster.stop()
    await expect.poll(() => client.cluster.isOnline(cluster.nodeId), quickly).toBe(false)
    await cluster.put('neuron:2', { title: 'While the client was away' })
    await cluster.restart()
    await expect.poll(() => seen.map((change) => change.id), quickly).toContain('neuron:2')
  })
})

describe('changes told over channels, with an orchestrator holding no data', () => {
  it('reach every holder straight from the one that wrote', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const holders = [await joinTracked(cluster.endpoint), await joinTracked(cluster.endpoint), await joinTracked(cluster.endpoint)]
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, ...holders.map((core) => core.nodeId)].sort())
    const [writer, ...others] = holders as [Core, Core, Core]

    await writer.dataset.put({ _id: 'neuron:1', from: 'writer' })
    for (const other of others) await expect.poll(async () => other.dataset.get('neuron:1'), told).toMatchObject({ from: 'writer' })
  })

  it('tells each change once: pulled-in copies do not tell it again', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const writer = await joinTracked(cluster.endpoint)
    const puller = await joinTracked(cluster.endpoint)
    const client = await joinTracked(cluster.endpoint, { storage: { engine: 'none' } })
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, writer.nodeId, puller.nodeId, client.nodeId].sort())
    const seen = collect(client)

    await writer.dataset.put({ _id: 'neuron:1' })
    await expect.poll(async () => puller.dataset.get('neuron:1'), told).toBeDefined()
    await settle()
    expect(seen.filter((change) => change.id === 'neuron:1')).toHaveLength(1)
  })

  it('catches up a holder that was closed while another wrote', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const writer = await joinTracked(cluster.endpoint)
    const home = freshHome()
    const away = await joinTracked(cluster.endpoint, { home })
    await expect.poll(async () => cluster.online(), quickly).toContain(away.nodeId)
    await away.close()

    await writer.dataset.put({ _id: 'neuron:1', title: 'Written while away' })
    const back = track(await openDataset(away.datasetId, { home }))
    await expect.poll(async () => back.dataset.get('neuron:1'), told).toMatchObject({ title: 'Written while away' })
  })

  it('brings holders that wrote while cut off back together', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const first = await joinTracked(cluster.endpoint)
    const second = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, first.nodeId, second.nodeId].sort())

    await cluster.stop()
    await expect.poll(() => first.cluster.isOnline(cluster.nodeId) || second.cluster.isOnline(cluster.nodeId), quickly).toBe(false)
    await first.dataset.put({ _id: 'neuron:1', from: 'first' })
    await second.dataset.put({ _id: 'neuron:2', from: 'second' })
    await cluster.restart()

    await expect.poll(async () => first.dataset.get('neuron:2'), quickly).toMatchObject({ from: 'second' })
    await expect.poll(async () => second.dataset.get('neuron:1'), quickly).toMatchObject({ from: 'first' })
  })

  it('reaches a Node.js holder and back, whatever runtime this one is', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const desk = await cluster.addMember({ name: 'Desk' })
    const core = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, desk.nodeId, core.nodeId].sort())

    await core.dataset.put({ _id: 'neuron:1', title: 'From here' })
    await expect.poll(async () => cluster.memberGet(desk.nodeId, 'neuron:1'), told).toMatchObject({ title: 'From here' })
  })

  it('closes promptly with pulls under way', async () => {
    const cluster = await HarnessCluster.start({ storage: 'none' })
    const writer = await joinTracked(cluster.endpoint)
    const puller = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, writer.nodeId, puller.nodeId].sort())

    for (let index = 0; index < 20; index += 1) await writer.dataset.put({ _id: `neuron:${index}` })
    const started = Date.now()
    await puller.close()
    expect(Date.now() - started).toBeLessThan(2500)
  })
})
