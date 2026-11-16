import { StorageError } from '../errors.js'
import { CLUSTER_DOCUMENT_ID, isClusterDocument, type ClusterDocument } from './ClusterDocument.js'

export async function readClusterDocument(database: PouchDB.Database, datasetId: string): Promise<ClusterDocument> {
  let document: unknown
  try {
    document = await database.get(CLUSTER_DOCUMENT_ID)
  } catch (cause) {
    throw new StorageError(datasetId, 'read the cluster document', cause)
  }
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
