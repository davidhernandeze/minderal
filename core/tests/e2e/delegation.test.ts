import { capabilities, CapabilityUnavailableError, NetworkError, PartialResultError, type Core } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, joinTracked } from '../support/datasets.js'
import { HarnessCluster } from '../support/harness.js'

const runtime = inject('runtime')
const server = inject('httpServerUrl')

describe('naming capabilities without strings', () => {
  it('finds nodes by the core method or by the catalog entry, which are the same capability', async () => {
    const core = await createTracked()
    expect(core.cluster.nodesWith(core.fetch)).toEqual(core.cluster.nodesWith(capabilities.fetch))
    expect(core.cluster.nodesWith(core.serve).map((node) => node.id)).toEqual(runtime === 'nodejs' ? [core.nodeId] : [])
  })

  it('rejects a function that is not a capability', async () => {
    const core = await createTracked()
    expect(() => core.cluster.nodesWith(() => 1)).toThrow(TypeError)
  })
})

/** A browser cannot fetch across origins freely, so it delegates fetch to a Node.js node of its cluster. */
describe.runIf(runtime === 'browser')('core.fetch() delegated by a BrowserCore', () => {
  async function joined(): Promise<{ cluster: HarnessCluster; core: Core }> {
    const cluster = await HarnessCluster.start()
    return { cluster, core: await joinTracked(cluster.endpoint) }
  }

  it('returns the complete response from the orchestrator', async () => {
    const { cluster, core } = await joined()
    const response = await core.fetch(`${server}/hello`)
    expect(response.status).toBe(200)
    expect(response.headers.get('x-served-by')).toBe('test-server')
    expect(await response.text()).toBe('hello')
    expect(core.cluster.qualityOf(cluster.nodeId)).toMatchObject({ successes: 1, failures: 0, latencyMs: expect.any(Number) })
  })

  it('carries the method, headers and a binary body', async () => {
    const { core } = await joined()
    const response = await core.fetch(`${server}/echo`, {
      method: 'PUT',
      headers: { 'x-minderal-test': 'yes' },
      body: new Uint8Array([0, 1, 254, 255]),
    })
    expect(await response.json()).toMatchObject({ method: 'PUT', header: 'yes', bodyBase64: 'AAH+/w==' })
  })

  it('returns HTTP error statuses as responses', async () => {
    const { core } = await joined()
    expect((await core.fetch(`${server}/missing`)).status).toBe(404)
  })

  it('streams the body as it arrives', async () => {
    const { core } = await joined()
    const response = await core.fetch(`${server}/stream?chunks=5&interval=10`)
    expect(await response.text()).toBe('chunk-0\nchunk-1\nchunk-2\nchunk-3\nchunk-4\n')
  })

  it('throws the NetworkError the orchestrator ran into', async () => {
    const { core } = await joined()
    const unreachable = inject('closedServerUrl')
    const failure = core.fetch(unreachable)
    await expect(failure).rejects.toThrow(NetworkError)
    await expect(failure).rejects.toMatchObject({ url: unreachable })
  })

  it('throws CapabilityUnavailableError, naming the node tried, when no node can be reached', async () => {
    const { cluster, core } = await joined()
    await cluster.stop()
    const failure = core.fetch(`${server}/hello`)
    await expect(failure).rejects.toThrow(CapabilityUnavailableError)
    await expect(failure).rejects.toMatchObject({ capability: 'fetch@1', attempts: [{ nodeId: cluster.nodeId }] })
    expect(core.cluster.qualityOf(cluster.nodeId)).toMatchObject({ failures: 1 })
  })

  it('surfaces a body cut short as PartialResultError where it is read, without crashing', async () => {
    const { cluster, core } = await joined()
    const response = await core.fetch(`${server}/stream?chunks=200&interval=20`)
    const reader = response.body!.getReader()
    const first = await reader.read()
    expect(new TextDecoder().decode(first.value)).toContain('chunk-0')

    await cluster.stop()
    const rest = (async () => {
      while (!(await reader.read()).done) {
        // keep reading until the cut surfaces
      }
    })()
    await expect(rest).rejects.toThrow(PartialResultError)
    await expect(rest).rejects.toMatchObject({ nodeId: cluster.nodeId, receivedBytes: expect.any(Number) })
    expect(core.cluster.qualityOf(cluster.nodeId)?.failures).toBe(1)
  })

  it('falls back to the next best node, and keeps preferring it while the first is down', async () => {
    const { cluster, core } = await joined()
    const member = await cluster.addMember({ name: 'Backup server', serve: true })
    await expect.poll(() => core.cluster.nodesWith(core.fetch).filter((node) => node.endpoint !== undefined).length, { timeout: 5000 }).toBe(2)
    await expect.poll(async () => (await cluster.memberNodes(member.nodeId)).some((node) => node.id === core.nodeId), { timeout: 5000 }).toBe(true)
    await cluster.stop()

    expect(await (await core.fetch(`${server}/hello`)).text()).toBe('hello')
    expect(await (await core.fetch(`${server}/hello`)).text()).toBe('hello')
    expect(core.cluster.qualityOf(cluster.nodeId)).toMatchObject({ failures: 1, successes: 0 })
    expect(core.cluster.qualityOf(member.nodeId)).toMatchObject({ failures: 0, successes: 2 })
  })
})
