import { ClusterError, CORE_VERSION, NetworkError, openDataset } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { freshHome, joinTracked, track } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const runtime = inject('runtime')

describe('joinDataset()', () => {
  it('joins as a member with a node id the orchestrator generated', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint, { name: 'Test node' })

    expect(core.datasetId).toBe(cluster.datasetId)
    expect(core.role).toBe('member')
    expect(core.cluster.orchestrator?.id).toBe(cluster.nodeId)
    expect(core.cluster.self).toEqual({
      id: core.nodeId,
      name: 'Test node',
      runtime,
      role: 'member',
      coreVersion: CORE_VERSION,
      capabilities: runtime === 'nodejs' ? ['database@1', 'fetch@1', 'serve@1'] : ['database@1'],
      userAgent: expect.any(String),
      os: expect.any(String),
      joinedAt: expect.any(String),
      announcedAt: expect.any(String),
    })
    expect((await cluster.nodes()).map((node) => node.id)).toEqual([cluster.nodeId, core.nodeId])
  })

  it('copies the dataset into local storage', async () => {
    const cluster = await HarnessCluster.start()
    await cluster.put('neuron:1', { title: 'Written before joining' })
    const core = await joinTracked(cluster.endpoint)
    expect(await core.dataset.get('neuron:1')).toMatchObject({ title: 'Written before joining' })
  })

  it('opens the dataset instead when this runtime already joined it', async () => {
    const cluster = await HarnessCluster.start()
    const home = freshHome()
    const first = await joinTracked(cluster.endpoint, { home })
    await first.close()
    const again = await joinTracked(cluster.endpoint, { home })
    expect(again.nodeId).toBe(first.nodeId)
    expect(await cluster.nodes()).toHaveLength(2)
  })

  it('reopens a joined dataset as a member, from local storage', async () => {
    const cluster = await HarnessCluster.start()
    const home = freshHome()
    const joined = await joinTracked(cluster.endpoint, { home })
    await joined.close()
    await cluster.stop()

    const reopened = track(await openDataset(joined.datasetId, { home }))
    expect(reopened.role).toBe('member')
    expect(reopened.cluster.orchestrator?.id).toBe(cluster.nodeId)
  })

  it('announces a new name through the orchestrator', async () => {
    const cluster = await HarnessCluster.start()
    const home = freshHome()
    const joined = await joinTracked(cluster.endpoint, { home, name: 'Before' })
    await joined.close()
    const renamed = track(await openDataset(joined.datasetId, { home, name: 'After' }))
    await expect.poll(async () => (await cluster.nodes()).find((node) => node.id === renamed.nodeId)?.name).toBe('After')
  })

  it('throws NetworkError when the endpoint cannot be reached', async () => {
    const unreachable = `${new URL(inject('closedServerUrl')).origin}/minderal-x`
    await expect(joinTracked(unreachable)).rejects.toThrow(NetworkError)
  })

  it('throws ClusterError when the endpoint is not a dataset', async () => {
    const cluster = await HarnessCluster.start()
    await expect(joinTracked(`${new URL(cluster.endpoint).origin}/minderal-unknown`)).rejects.toThrow(ClusterError)
  })
})

describe('sync between a member and its orchestrator', () => {
  it('pushes and pulls documents on core.sync()', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await core.dataset.put({ _id: 'from:member', value: 1 })
    await cluster.put('from:orchestrator', { value: 2 })

    await core.sync()
    expect(await cluster.get('from:member')).toMatchObject({ value: 1 })
    expect(await core.dataset.get('from:orchestrator')).toMatchObject({ value: 2 })
  })

  it('syncs live in the background', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await cluster.put('live:1', { value: 'arrives by itself' })
    await expect.poll(async () => core.dataset.get('live:1'), { timeout: 5000 }).toMatchObject({ value: 'arrives by itself' })

    await core.dataset.put({ _id: 'live:2', value: 'and leaves by itself' })
    await expect.poll(async () => cluster.get('live:2'), { timeout: 5000 }).toMatchObject({ value: 'and leaves by itself' })
  })

  it('keeps working offline and catches up when the orchestrator returns', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await cluster.stop()

    await core.dataset.put({ _id: 'offline:1', value: 'written offline' })
    expect(await core.dataset.get('offline:1')).toMatchObject({ value: 'written offline' })
    await expect(core.sync()).rejects.toThrow(NetworkError)

    await cluster.restart()
    await core.sync()
    expect(await cluster.get('offline:1')).toMatchObject({ value: 'written offline' })
  })

  it('ends with the same winner and the conflict on both sides after concurrent edits', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const { rev } = await core.dataset.put({ _id: 'shared', value: 'original' })
    await core.sync()
    await cluster.stop()

    await core.dataset.put({ _id: 'shared', _rev: rev, value: 'edited by the member' })
    const remote = await cluster.get('shared')
    await cluster.put('shared', { _rev: remote?._rev, value: 'edited by the orchestrator' })
    await cluster.restart()
    await core.sync()

    const mine = await core.dataset.get('shared', { conflicts: true })
    const theirs = await cluster.get('shared')
    expect(mine?._rev).toBe(theirs?._rev)
    expect(mine?.value).toBe(theirs?.value)
    expect(mine?._conflicts).toHaveLength(1)
    expect(theirs?._conflicts).toEqual(mine?._conflicts)
  })

  it('sees cluster changes made by the orchestrator', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const changes: number[] = []
    const unsubscribe = core.cluster.subscribe(() => changes.push(core.cluster.nodes.length))
    const { nodeId } = await cluster.addMember({ name: 'Another member' })

    await expect.poll(() => core.cluster.nodes.map((node) => node.id), { timeout: 5000 }).toContain(nodeId)
    expect(changes.length).toBeGreaterThan(0)
    unsubscribe()
  })

  it('reports nothing to sync on a core without an upstream', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    expect(core.role).toBe('member')
    const solo = track(await (await import('@minderal/core')).createDataset({ home: freshHome() }))
    expect(await solo.sync()).toEqual({ pushed: 0, pulled: 0 })
  })
})
