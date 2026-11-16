import type { Runtime } from '../Runtime.js'

export const CLUSTER_DOCUMENT_ID = '_design/cluster'

export type NodeRole = 'orchestrator' | 'member'

export interface ClusterNode {
  readonly id: string
  readonly runtime: Runtime
  readonly role: NodeRole
}

export interface ClusterDocument {
  readonly _id: typeof CLUSTER_DOCUMENT_ID
  readonly _rev?: string
  readonly dataset: string
  readonly nodes: readonly ClusterNode[]
  readonly endpoints: readonly string[]
}

export function newClusterDocument(datasetId: string, founder: ClusterNode): ClusterDocument {
  return { _id: CLUSTER_DOCUMENT_ID, dataset: datasetId, nodes: [founder], endpoints: [] }
}

export function isClusterDocument(value: unknown): value is ClusterDocument {
  if (typeof value !== 'object' || value === null) return false
  const candidate: { _id?: unknown; dataset?: unknown; nodes?: unknown; endpoints?: unknown } = value
  return (
    candidate._id === CLUSTER_DOCUMENT_ID &&
    typeof candidate.dataset === 'string' &&
    Array.isArray(candidate.nodes) &&
    candidate.nodes.every(isClusterNode) &&
    Array.isArray(candidate.endpoints) &&
    candidate.endpoints.every((endpoint) => typeof endpoint === 'string')
  )
}

function isClusterNode(value: unknown): value is ClusterNode {
  if (typeof value !== 'object' || value === null) return false
  const candidate: { id?: unknown; runtime?: unknown; role?: unknown } = value
  return (
    typeof candidate.id === 'string' &&
    (candidate.runtime === 'nodejs' || candidate.runtime === 'browser') &&
    (candidate.role === 'orchestrator' || candidate.role === 'member')
  )
}
