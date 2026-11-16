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

  /** `{ storage: 'none' }` starts an orchestrator that holds no data. Leases: 200 ms heartbeats, 1 s lease. */
  static async start(options: { storage?: 'none' } = {}): Promise<HarnessCluster> {
    const cluster = new HarnessCluster(await call('POST', '/clusters', options))
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

  async removeMember(memberId: string): Promise<void> {
    await call('DELETE', `/clusters/${this.datasetId}/members/${memberId}`)
  }

  /** Syncs a harness member now; resolves with the name of the error it threw, if any. */
  async syncMember(memberId: string): Promise<{ pushed?: number; pulled?: number; error?: string }> {
    const response = await fetch(`${base}/clusters/${this.datasetId}/members/${memberId}/sync`, { method: 'POST' })
    return (await response.json()) as { pushed?: number; pulled?: number; error?: string }
  }

  async memberGet(memberId: string, id: string): Promise<StoredDocument | undefined> {
    const value = await call<StoredDocument & { error?: string }>(
      'GET',
      `/clusters/${this.datasetId}/members/${memberId}/documents/${encodeURIComponent(id)}`,
    )
    return value.error === undefined ? value : undefined
  }

  /** The orchestrator's status endpoint, as any client sees it. */
  async status(): Promise<{ online: { id: string; since: string }[]; holdsData: boolean; nodes: ClusterNode[] }> {
    return (await fetch(`${this.endpoint}/_minderal/status`)).json() as Promise<{
      online: { id: string; since: string }[]
      holdsData: boolean
      nodes: ClusterNode[]
    }>
  }

  async online(): Promise<string[]> {
    try {
      return (await this.status()).online.map(({ id }) => id).sort()
    } catch {
      return []
    }
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
