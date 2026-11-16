import { capabilities, CapabilityUnavailableError, joinDataset, openDataset } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, freshHome, track } from '../support/datasets.js'

const runtime = inject('runtime')

describe.runIf(runtime === 'browser')('core.serve() on a BrowserCore', () => {
  it('throws CapabilityUnavailableError: a browser cannot accept connections', async () => {
    const core = await createTracked()
    const failure = core.serve()
    await expect(failure).rejects.toThrow(CapabilityUnavailableError)
    await expect(failure).rejects.toMatchObject({ capability: capabilities.serve.id })
  })
})

describe.runIf(runtime === 'nodejs')('core.serve() on a ServerCore', () => {
  it('serves the dataset and records the endpoint on its own cluster node', async () => {
    const core = await createTracked()
    const url = await core.serve()
    expect(url).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/minderal-${core.datasetId}$`))
    expect(core.cluster.nodes).toEqual([expect.objectContaining({ id: core.nodeId, runtime: 'nodejs', role: 'orchestrator', endpoint: url })])
  })

  it('returns the same endpoint when asked to serve again, even concurrently', async () => {
    const core = await createTracked()
    const [first, second] = await Promise.all([core.serve(), core.serve()])
    expect(second).toBe(first)
    expect(await core.serve()).toBe(first)
  })

  it('keeps the endpoint in the cluster document across reopening', async () => {
    const home = freshHome()
    const core = await createTracked({ home })
    const url = await core.serve()
    await core.close()

    const reopened = track(await openDataset(core.datasetId, { home }))
    expect(reopened.cluster.nodes[0]?.endpoint).toBe(url)
  })

  it('advertises publicUrl instead of the bound address', async () => {
    const core = await createTracked()
    const url = await core.serve({ publicUrl: 'https://desk.example:8443/' })
    expect(url).toBe(`https://desk.example:8443/minderal-${core.datasetId}`)
  })

  it('refuses to bind every interface without a publicUrl to advertise', async () => {
    const core = await createTracked()
    await expect(core.serve({ host: '0.0.0.0' })).rejects.toThrow(TypeError)
  })

  it('lets no browser origin in by default', async () => {
    const core = await createTracked()
    const url = await core.serve()
    const preflight = await fetch(`${url}/_changes`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    })
    expect(preflight.status).toBe(403)
    const read = await fetch(`${url}/_minderal/status`, { headers: { origin: 'https://evil.example' } })
    expect(read.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('lets the origins it was given in, with credentials, as PouchDB requires', async () => {
    const core = await createTracked()
    const url = await core.serve({ origins: ['http://localhost:5173'] })
    const preflight = await fetch(`${url}/_bulk_docs`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(preflight.headers.get('access-control-allow-credentials')).toBe('true')
    expect(preflight.headers.get('access-control-allow-headers')).toBe('content-type')
    const root = await fetch(new URL('/', url), { headers: { origin: 'http://localhost:5173' } })
    expect(root.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('rejects origins that are not origins', async () => {
    const core = await createTracked()
    await expect(core.serve({ origins: ['http://localhost:5173/app'] })).rejects.toThrow(TypeError)
  })

  it('accepts joins and announcements only on the orchestrator', async () => {
    const orchestrator = await createTracked()
    const endpoint = await orchestrator.serve()
    const member = track(await joinDataset(endpoint, { home: freshHome() }))
    const memberUrl = await member.serve()
    const join = await fetch(`${memberUrl}/_minderal/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ node: { name: 'x', runtime: 'browser', coreVersion: '0.0.0', capabilities: [] } }),
    })
    expect(join.status).toBe(403)
    await expect.poll(() => orchestrator.cluster.nodes.find((node) => node.id === member.nodeId)?.endpoint).toBe(memberUrl)
  })

  it('performs capabilities only for nodes of its cluster', async () => {
    const core = await createTracked()
    const url = await core.serve()
    const stranger = await fetch(`${url}/_minderal/invoke/fetch@1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-minderal-node': crypto.randomUUID() },
      body: JSON.stringify({ args: { url: 'http://127.0.0.1:1/' } }),
    })
    expect(stranger.status).toBe(403)
  })

  it('answers the cluster status endpoint', async () => {
    const core = await createTracked()
    const url = await core.serve()
    const response = await fetch(`${url}/_minderal/status`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ dataset: core.datasetId, nodes: core.cluster.nodes, online: [{ id: core.nodeId, since: expect.any(String) }], holdsData: true })
  })

  it('identifies itself like a CouchDB server', async () => {
    const core = await createTracked()
    const url = new URL(await core.serve())
    const response = await fetch(new URL('/', url))
    expect(await response.json()).toMatchObject({ couchdb: 'Welcome', uuid: expect.any(String) })
  })

  it('serves several datasets on one port', async () => {
    const first = await createTracked()
    const second = await createTracked()
    const firstUrl = new URL(await first.serve())
    const secondUrl = new URL(await second.serve({ port: Number(firstUrl.port) }))
    expect(secondUrl.port).toBe(firstUrl.port)
    expect((await fetch(`${secondUrl.href}/_minderal/status`)).status).toBe(200)

    await first.close()
    expect((await fetch(`${firstUrl.href}/_minderal/status`)).status).toBe(404)
    expect((await fetch(`${secondUrl.href}/_minderal/status`)).status).toBe(200)
  })

  it('stops listening when its last served core closes', async () => {
    const core = await createTracked()
    const url = await core.serve()
    await core.close()
    await expect(fetch(`${url}/_minderal/status`)).rejects.toThrow(TypeError)
  })

  it('answers 404 for a dataset it does not serve', async () => {
    const core = await createTracked()
    const url = new URL(await core.serve())
    const response = await fetch(new URL(`/minderal-${crypto.randomUUID()}`, url))
    expect(response.status).toBe(404)
  })

  it('lets a client pull the cluster document', async () => {
    const { memoryDatabase, remoteDatabase } = await import('../support/replicationClient.js')
    const core = await createTracked()
    const url = await core.serve()
    const client = memoryDatabase()
    await client.replicate.from(remoteDatabase(url))
    expect(await client.get('_design/cluster')).toMatchObject({ dataset: core.datasetId, nodes: core.cluster.nodes })
    await client.destroy()
  })

  it('rejects cluster document writes from clients and accepts the rest of the batch', async () => {
    const { memoryDatabase, remoteDatabase } = await import('../support/replicationClient.js')
    const core = await createTracked()
    const url = await core.serve()
    const client = memoryDatabase()
    await client.replicate.from(remoteDatabase(url))
    const cluster = await client.get('_design/cluster')
    await client.put({ ...cluster, nodes: [] })
    await client.put({ _id: 'ordinary' })

    const result = await client.replicate.to(remoteDatabase(url))
    expect(result.doc_write_failures).toBe(1)
    expect(result.docs_written).toBe(1)

    const status = await fetch(`${url}/_minderal/status`)
    expect(await status.json()).toMatchObject({ dataset: core.datasetId, nodes: core.cluster.nodes })
    const ordinary = await fetch(`${url}/ordinary`)
    expect(ordinary.status).toBe(200)
    await client.destroy()
  })

  it('closes promptly while a live replication is waiting on it', async () => {
    const { memoryDatabase, remoteDatabase } = await import('../support/replicationClient.js')
    const core = await createTracked()
    const url = await core.serve()
    const client = memoryDatabase()
    const live = client.replicate.from(remoteDatabase(url), { live: true, retry: false })
    await new Promise<void>((resolve) => live.on('paused', () => resolve()))
    const started = Date.now()
    await core.close()
    expect(Date.now() - started).toBeLessThan(1000)
    live.cancel()
    await client.destroy()
  })
})
