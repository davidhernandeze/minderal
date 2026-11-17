import type { DocumentChange, NewDocument, StoredDocument } from './Documents.js'

/** Where `core.documents` reads and writes: the core's own copy, or the cluster's. */
export interface DocumentStore {
  get(id: string, conflicts: boolean): Promise<StoredDocument | undefined>
  put(document: NewDocument): Promise<{ id: string; rev: string }>
  remove(id: string, rev: string): Promise<void>
  list(): Promise<StoredDocument[]>
  watch(listener: (change: DocumentChange) => void): () => void
}

export function byId(a: { _id: string }, b: { _id: string }): number {
  return a._id < b._id ? -1 : a._id > b._id ? 1 : 0
}
