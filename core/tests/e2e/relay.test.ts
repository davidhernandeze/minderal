import { describe, expect, it } from 'vitest'
import { joinTracked } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const quickly = { timeout: 5000 }

async function invokeDatabase(
  cluster: HarnessCluster,
  target: string,
  caller: string,
  request: { method: string; path: string[]; body?: unknown },
): Promise<{ status: number; frames: { t: string; v?: { status: number; json?: unknown } }[] }> {
  const response = await fetch(`${cluster.endpoint}/_minderal/relay/${target}/invoke/database@1`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-minderal-node': caller },
    body: JSON.stringify({ args: { query: {}, ...request } }),
  })
  if (response.status !== 200) return { status: response.status, frames: [] }
  const text = await response.text()
  return { status: 200, frames: text.trim().split('\n').map((line) => JSON.parse(line) as { t: string }) }
}

/** A node that cannot accept connections — a browser — still answers requests, relayed down its channel. */
describe('requests relayed to a node through the orchestrator', () => {
  it('reach a node without an endpoint and stream its answer back', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    await expect.poll(async () => cluster.online(), quickly).toContain(core.nodeId)

    // _local documents never replicate, so only this node can answer for this one
    const put = await invokeDatabase(cluster, core.nodeId, core.nodeId, { method: 'PUT', path: ['_local', 'proof'], body: { here: true } })
    expect(put.frames.map((frame) => frame.t)).toEqual(['head', 'end'])
    expect(put.frames[0]?.v?.status).toBe(201)

    const read = await invokeDatabase(cluster, core.nodeId, core.nodeId, { method: 'GET', path: ['_local', 'proof'] })
    expect(read.frames[0]?.v).toMatchObject({ status: 200, json: { here: true } })
    expect((await fetch(`${cluster.endpoint}/_local/proof`)).status).toBe(404)
  })

  it('answer 503 for a node that is not connected', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const member = await cluster.addMember()
    await cluster.removeMember(member.nodeId)
    const result = await invokeDatabase(cluster, member.nodeId, core.nodeId, { method: 'GET', path: [] })
    expect(result.status).toBe(503)
  })

  it('are refused to callers outside the cluster', async () => {
    const cluster = await HarnessCluster.start()
    const core = await joinTracked(cluster.endpoint)
    const result = await invokeDatabase(cluster, core.nodeId, crypto.randomUUID(), { method: 'GET', path: [] })
    expect(result.status).toBe(403)
  })
})
