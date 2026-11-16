import { describe, expect, it } from 'vitest'
import { joinTracked } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const quickly = { timeout: 5000 }

describe('presence', () => {
  it('lists a member as online at the orchestrator while its core is open', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId, core.nodeId].sort())

    await core.close()
    await expect.poll(async () => cluster.online(), quickly).toEqual([cluster.nodeId])
  })

  it('tells members who is online, and since when', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const other = await cluster.addMember({ name: 'Other member' })

    await expect.poll(() => core.cluster.isOnline(other.nodeId), quickly).toBe(true)
    expect(core.cluster.isOnline(cluster.nodeId)).toBe(true)
    expect(core.cluster.isOnline(core.nodeId)).toBe(true)
    expect(Date.parse(core.cluster.onlineSince(other.nodeId) ?? '')).not.toBeNaN()

    await cluster.removeMember(other.nodeId)
    await expect.poll(() => core.cluster.isOnline(other.nodeId), quickly).toBe(false)
  })

  it('sees the orchestrator go offline and come back', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await expect.poll(() => core.cluster.isOnline(cluster.nodeId), quickly).toBe(true)

    await cluster.stop()
    await expect.poll(() => core.cluster.isOnline(cluster.nodeId), quickly).toBe(false)
    await cluster.restart()
    await expect.poll(() => core.cluster.isOnline(cluster.nodeId), { timeout: 10_000 }).toBe(true)
    await expect.poll(async () => cluster.online(), quickly).toContain(core.nodeId)
  })

  it('drops a member whose lease runs out without heartbeats', async () => {
    const cluster = await HarnessCluster.start()
    const join = await fetch(`${cluster.endpoint}/_minderal/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ node: { name: 'Silent', runtime: 'browser', coreVersion: '0.0.0', capabilities: [] } }),
    })
    const { nodeId } = (await join.json()) as { nodeId: string }
    const abort = new AbortController()
    const channel = await fetch(`${cluster.endpoint}/_minderal/channel?node=${nodeId}`, { signal: abort.signal })
    const reader = channel.body!.getReader()
    const welcome = new TextDecoder().decode((await reader.read()).value)
    expect(welcome).toContain('"t":"welcome"')

    await expect.poll(async () => cluster.online(), quickly).toContain(nodeId)
    await expect.poll(async () => cluster.online(), quickly).not.toContain(nodeId)
    abort.abort()
  })

  it('pushes cluster changes to members over the channel', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const other = await cluster.addMember({ name: 'Newcomer' })
    await expect.poll(() => core.cluster.nodes.find((node) => node.id === other.nodeId)?.name, quickly).toBe('Newcomer')
  })

  it('refuses channels to nodes outside the cluster', async () => {
    const cluster = await HarnessCluster.start()
    const response = await fetch(`${cluster.endpoint}/_minderal/channel?node=${crypto.randomUUID()}`)
    expect(response.status).toBe(403)
  })
})
