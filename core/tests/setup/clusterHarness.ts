import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { createDataset, joinDataset, openDataset, type Core } from '../../src/index.js'

/**
 * Real cluster nodes for tests, in this Node.js process, driven over HTTP so tests in every runtime use
 * them the same way: a browser test joins a served orchestrator here, then stops it to go offline.
 *
 *   POST   /clusters                              new orchestrator, served → { datasetId, nodeId, endpoint }
 *   POST   /clusters/:id/members  { name, serve } Node.js member joined (and serving) → { nodeId, endpoint? }
 *   GET    /clusters/:id/cluster                  the orchestrator's cluster view
 *   GET    /clusters/:id/members/:node/cluster    a member's cluster view
 *   PUT    /clusters/:id/documents/:doc           write on the orchestrator, served or not
 *   GET    /clusters/:id/documents/:doc           read from the orchestrator (with _conflicts)
 *   POST   /clusters/:id/stop | /start            take the orchestrator offline / back on its port
 *   DELETE /clusters/:id                          close everything
 */
interface HarnessCluster {
  readonly datasetId: string
  readonly home: string
  readonly port: number
  orchestrator: Core | undefined
  readonly members: Map<string, Core>
}

const ORIGINS = ['*']

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const root = await mkdtemp(join(tmpdir(), 'minderal-harness-'))
  const clusters = new Map<string, HarnessCluster>()
  const server = createServer((request, response) => {
    void handle(request, response, clusters, root).catch((error: unknown) => {
      if (!response.headersSent) send(response, 500, { error: String(error) })
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  project.provide('clusterHarnessUrl', `http://127.0.0.1:${(server.address() as AddressInfo).port}`)
  return async () => {
    for (const cluster of clusters.values()) await closeCluster(cluster)
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await rm(root, { recursive: true, force: true })
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, clusters: Map<string, HarnessCluster>, root: string): Promise<void> {
  response.setHeader('access-control-allow-origin', '*')
  if (request.method === 'OPTIONS') {
    response.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE')
    response.setHeader('access-control-allow-headers', 'content-type')
    response.writeHead(204).end()
    return
  }
  const url = new URL(request.url ?? '/', 'http://localhost')
  const [base, datasetId, action, target, extra] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const method = request.method ?? 'GET'
  if (base !== 'clusters') return send(response, 404, { error: 'unknown path' })

  if (datasetId === undefined && method === 'POST') {
    const home = join(root, crypto.randomUUID())
    const core = await createDataset({ home, name: 'Harness orchestrator' })
    const endpoint = await core.serve({ origins: ORIGINS })
    clusters.set(core.datasetId, { datasetId: core.datasetId, home, port: Number(new URL(endpoint).port), orchestrator: core, members: new Map() })
    return send(response, 201, { datasetId: core.datasetId, nodeId: core.nodeId, endpoint })
  }

  const cluster = datasetId === undefined ? undefined : clusters.get(datasetId)
  if (cluster === undefined) return send(response, 404, { error: 'unknown cluster' })
  const body = method === 'POST' || method === 'PUT' ? await readBody(request) : undefined

  if (action === undefined && method === 'DELETE') {
    await closeCluster(cluster)
    clusters.delete(cluster.datasetId)
    return send(response, 200, { ok: true })
  }
  if (action === 'stop' && method === 'POST') {
    await cluster.orchestrator?.close()
    cluster.orchestrator = undefined
    return send(response, 200, { ok: true })
  }
  if (action === 'start' && method === 'POST') {
    cluster.orchestrator ??= await openDataset(cluster.datasetId, { home: cluster.home })
    const endpoint = await cluster.orchestrator.serve({ port: cluster.port, origins: ORIGINS })
    return send(response, 200, { endpoint })
  }
  if (action === 'cluster' && method === 'GET') {
    const orchestrator = cluster.orchestrator
    if (orchestrator === undefined) return send(response, 409, { error: 'orchestrator is stopped' })
    return send(response, 200, { nodes: orchestrator.cluster.nodes })
  }
  if (action === 'members' && target === undefined && method === 'POST') {
    const options = body as { name?: string; serve?: boolean }
    const orchestrator = cluster.orchestrator
    if (orchestrator === undefined) return send(response, 409, { error: 'orchestrator is stopped' })
    const endpoint = orchestrator.cluster.self?.endpoint ?? ''
    const member = await joinDataset(endpoint, { home: join(root, crypto.randomUUID()), name: options.name ?? 'Harness member' })
    cluster.members.set(member.nodeId, member)
    const served = options.serve === true ? await member.serve({ origins: ORIGINS }) : undefined
    return send(response, 201, { nodeId: member.nodeId, ...(served === undefined ? {} : { endpoint: served }) })
  }
  if (action === 'members' && target !== undefined && extra === 'cluster' && method === 'GET') {
    const member = cluster.members.get(target)
    if (member === undefined) return send(response, 404, { error: 'unknown member' })
    return send(response, 200, { nodes: member.cluster.nodes })
  }
  if (action === 'documents' && target !== undefined) {
    return withOrchestrator(cluster, async (orchestrator) => {
      if (method === 'PUT') return send(response, 201, await orchestrator.documents.put({ ...(body as object), _id: target }))
      const document = await orchestrator.documents.get(target, { conflicts: true })
      return document === undefined ? send(response, 404, { error: 'not_found' }) : send(response, 200, document)
    })
  }
  return send(response, 404, { error: 'unknown path' })
}

/** Runs against the orchestrator, opening its dataset without serving it while the orchestrator is stopped. */
async function withOrchestrator(cluster: HarnessCluster, run: (core: Core) => Promise<void>): Promise<void> {
  if (cluster.orchestrator !== undefined) return run(cluster.orchestrator)
  const offline = await openDataset(cluster.datasetId, { home: cluster.home })
  try {
    await run(offline)
  } finally {
    await offline.close()
  }
}

async function closeCluster(cluster: HarnessCluster): Promise<void> {
  await Promise.allSettled([...cluster.members.values()].map(async (member) => member.close()))
  await cluster.orchestrator?.close()
  cluster.orchestrator = undefined
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  let text = ''
  for await (const chunk of request) text += String(chunk)
  return text === '' ? {} : JSON.parse(text)
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}
