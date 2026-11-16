import { DocumentConflictError, StorageError } from '../errors.js'

/** A document as stored: its id, revision, and the fields it was written with. */
export interface StoredDocument {
  readonly _id: string
  readonly _rev: string
  /** Revisions that lost an unresolved conflict; present when asked for with `{ conflicts: true }`. */
  readonly _conflicts?: readonly string[]
  readonly [field: string]: unknown
}

export interface NewDocument {
  readonly _id: string
  /** The revision being replaced; omit to create. */
  readonly _rev?: string
  readonly [field: string]: unknown
}

export interface DocumentChange {
  readonly id: string
  readonly deleted: boolean
}

/**
 * Raw document access. Provisional: it exists so sync can be exercised and seen end to end, and gives way
 * to the neuron and template model once that lands. System ids (`_design/…`, `_local/…`) are off limits.
 */
export class Documents {
  private readonly database: () => PouchDB.Database
  private readonly datasetId: string
  private readonly guard: () => void
  private readonly feeds: Set<() => void>

  constructor(database: () => PouchDB.Database, datasetId: string, guard: () => void) {
    this.database = database
    this.datasetId = datasetId
    this.guard = guard
    this.feeds = new Set()
  }

  /** Stops every watcher; the core calls it when it closes. */
  stopWatching(): void {
    for (const stop of [...this.feeds]) stop()
  }

  async get(id: string, options: { readonly conflicts?: boolean } = {}): Promise<StoredDocument | undefined> {
    this.guard()
    checkId(id)
    try {
      return (await this.database().get(id, { conflicts: options.conflicts === true })) as unknown as StoredDocument
    } catch (error) {
      if (status(error) === 404) return undefined
      throw new StorageError(this.datasetId, `read document ${id}`, error)
    }
  }

  async put(document: NewDocument): Promise<{ id: string; rev: string }> {
    this.guard()
    checkId(document._id)
    try {
      const { id, rev } = await this.database().put({ ...document })
      return { id, rev }
    } catch (error) {
      if (status(error) === 409) throw new DocumentConflictError(this.datasetId, document._id)
      throw new StorageError(this.datasetId, `write document ${document._id}`, error)
    }
  }

  async remove(id: string, rev: string): Promise<void> {
    this.guard()
    checkId(id)
    try {
      await this.database().remove(id, rev)
    } catch (error) {
      if (status(error) === 409) throw new DocumentConflictError(this.datasetId, id)
      throw new StorageError(this.datasetId, `remove document ${id}`, error)
    }
  }

  /** Every document, ordered by id. */
  async list(): Promise<StoredDocument[]> {
    this.guard()
    try {
      const { rows } = await this.database().allDocs({ include_docs: true })
      return rows.flatMap((row) => (row.id.startsWith('_') || row.doc === undefined ? [] : [row.doc as unknown as StoredDocument]))
    } catch (error) {
      throw new StorageError(this.datasetId, 'list documents', error)
    }
  }

  /** Calls the listener for every change from now on, local or synced in. Returns the stop function. */
  watch(listener: (change: DocumentChange) => void): () => void {
    this.guard()
    const feed = this.database().changes({ since: 'now', live: true })
    feed.on('change', (change) => {
      if (change.id.startsWith('_')) return
      try {
        listener({ id: change.id, deleted: change.deleted === true })
      } catch {
        // a failing listener must not stop the feed
      }
    })
    feed.on('error', () => undefined)
    const stop = (): void => {
      if (!this.feeds.delete(stop)) return
      feed.cancel()
    }
    this.feeds.add(stop)
    return stop
  }
}

function checkId(id: string): void {
  if (typeof id !== 'string' || id === '') throw new TypeError('A document needs an id')
  if (id.startsWith('_')) throw new TypeError(`Document ids starting with _ are reserved for the system: ${id}`)
}

function status(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : undefined
}
