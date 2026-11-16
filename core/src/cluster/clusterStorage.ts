import { StorageError } from '../errors.js'
import { CLUSTER_DOCUMENT_ID, isClusterDocument, type ClusterDocument } from './ClusterDocument.js'

const MAX_ATTEMPTS = 8

export async function readClusterDocument(database: PouchDB.Database, datasetId: string): Promise<ClusterDocument> {
  let document: unknown
  try {
    document = await database.get(CLUSTER_DOCUMENT_ID)
  } catch (cause) {
    throw new StorageError(datasetId, 'read the cluster document', cause)
  }
  return validClusterDocument(document, datasetId)
}

export function validClusterDocument(document: unknown, datasetId: string): ClusterDocument {
  if (!isClusterDocument(document) || document.dataset !== datasetId) {
    throw new StorageError(datasetId, 'read a valid cluster document', document)
  }
  return document
}

export async function writeClusterDocument(
  database: PouchDB.Database,
  datasetId: string,
  document: ClusterDocument,
): Promise<ClusterDocument> {
  try {
    const { rev } = await database.put({ ...document })
    return { ...document, _rev: rev }
  } catch (cause) {
    throw new StorageError(datasetId, 'write the cluster document', cause)
  }
}

/**
 * Reads, changes and writes the cluster document, starting over when another writer got there first:
 * joins and announcements arrive concurrently. `change` returns undefined when there is nothing to write.
 */
export async function updateClusterDocument(
  database: PouchDB.Database,
  datasetId: string,
  change: (document: ClusterDocument) => ClusterDocument | undefined,
): Promise<ClusterDocument> {
  for (let attempt = 1; ; attempt += 1) {
    const current = await readClusterDocument(database, datasetId)
    const changed = change(current)
    if (changed === undefined) return current
    try {
      const { rev } = await database.put({ ...changed, _rev: current._rev })
      return { ...changed, _rev: rev }
    } catch (cause) {
      if (!isConflict(cause) || attempt >= MAX_ATTEMPTS) throw new StorageError(datasetId, 'write the cluster document', cause)
    }
  }
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 409
}
