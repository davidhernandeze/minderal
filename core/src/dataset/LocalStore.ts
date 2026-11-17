import type { WrittenChange } from '../database/couchApi.js'
import { DocumentConflictError, StorageError } from '../errors.js'
import type { DocumentStore } from './DocumentStore.js'
import type { StoredDocument } from './Dataset.js'

/** Documents in the core's own copy of the dataset. */
export function localStore(database: PouchDB.Database, datasetId: string, onWrite: (changes: WrittenChange[]) => void = () => undefined): DocumentStore {
  return {
    async get(id, conflicts) {
      try {
        return (await database.get(id, { conflicts })) as unknown as StoredDocument
      } catch (error) {
        if (statusOf(error) === 404) return undefined
        throw new StorageError(datasetId, `read document ${id}`, error)
      }
    },

    async put(document) {
      try {
        const { id, rev } = await database.put({ ...document })
        onWrite([{ id, deleted: false }])
        return { id, rev }
      } catch (error) {
        if (statusOf(error) === 409) throw new DocumentConflictError(datasetId, document._id)
        throw new StorageError(datasetId, `write document ${document._id}`, error)
      }
    },

    async remove(id, rev) {
      try {
        await database.remove(id, rev)
        onWrite([{ id, deleted: true }])
      } catch (error) {
        if (statusOf(error) === 409) throw new DocumentConflictError(datasetId, id)
        throw new StorageError(datasetId, `remove document ${id}`, error)
      }
    },

    async list() {
      try {
        const { rows } = await database.allDocs({ include_docs: true })
        return rows.flatMap((row) => (row.id.startsWith('_') || row.doc === undefined ? [] : [row.doc as unknown as StoredDocument]))
      } catch (error) {
        throw new StorageError(datasetId, 'list documents', error)
      }
    },

    watch(listener) {
      const feed = database.changes({ since: 'now', live: true })
      feed.on('change', (change) => listener({ id: change.id, deleted: change.deleted === true }))
      feed.on('error', () => undefined)
      return () => feed.cancel()
    },
  }
}

export function statusOf(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
}
