import type { ClusterNode, StoredDocument } from '@minderal/core'
import { afterEach, inject } from 'vitest'

const base = inject('clusterHarnessUrl')
const created: string[] = []

afterEach(async () => {
  await Promise.all(created.splice(0).map(async (id) => call('DELETE', `/clusters/${id}`)))
})

async function call<Result>(method: string, path: string, body?: unknown): Promise<Result> {
  const response = await fetch(`${base}${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  })
  const value = (await response.json()) as Result
  if (!response.ok && response.status !== 404) throw new Error(`harness ${method} ${path}: ${response.status} ${JSON.stringify(value)}`)
  return value
}

/** A served orchestrator in the harness process; closed after the test. */
export class HarnessCluster {
  readonly datasetId: string
  readonly nodeId: string
  readonly endpoint: string

  private constructor(created: { datasetId: string; nodeId: string; endpoint: string }) {
    this.datasetId = created.datasetId
    this.nodeId = created.nodeId
    this.endpoint = created.endpoint
  }

  static async start(): Promise<HarnessCluster> {
    const cluster = new HarnessCluster(await call('POST', '/clusters'))
    created.push(cluster.datasetId)
    return cluster
  }

  async nodes(): Promise<ClusterNode[]> {
    return (await call<{ nodes: ClusterNode[] }>('GET', `/clusters/${this.datasetId}/cluster`)).nodes
  }

  async memberNodes(memberId: string): Promise<ClusterNode[]> {
    return (await call<{ nodes: ClusterNode[] }>('GET', `/clusters/${this.datasetId}/members/${memberId}/cluster`)).nodes
  }

  /** A Node.js member, joined and optionally serving, in the harness process. */
  async addMember(options: { name?: string; serve?: boolean } = {}): Promise<{ nodeId: string; endpoint?: string }> {
    return call('POST', `/clusters/${this.datasetId}/members`, options)
  }

  async put(id: string, fields: Record<string, unknown>): Promise<{ rev: string }> {
    return call('PUT', `/clusters/${this.datasetId}/documents/${encodeURIComponent(id)}`, fields)
  }

  async get(id: string): Promise<StoredDocument | undefined> {
    const value = await call<StoredDocument & { error?: string }>('GET', `/clusters/${this.datasetId}/documents/${encodeURIComponent(id)}`)
    return value.error === undefined ? value : undefined
  }

  /** Takes the orchestrator offline: its endpoint stops answering. */
  async stop(): Promise<void> {
    await call('POST', `/clusters/${this.datasetId}/stop`)
  }

  /** Brings the orchestrator back, on the same endpoint. */
  async restart(): Promise<void> {
    await call('POST', `/clusters/${this.datasetId}/start`)
  }
}
