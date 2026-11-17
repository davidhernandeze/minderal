import type { DocumentStore } from './DocumentStore.js'

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
 *
 * The same API whether the core holds a copy or not: a core without one — client mode — reads and writes
 * through a node of its cluster that holds the data.
 */
export class Dataset {
  private readonly store: () => DocumentStore
  private readonly guard: () => void
  private readonly feeds: Set<() => void>

  constructor(store: () => DocumentStore, guard: () => void) {
    this.store = store
    this.guard = guard
    this.feeds = new Set()
  }

  async get(id: string, options: { readonly conflicts?: boolean } = {}): Promise<StoredDocument | undefined> {
    this.guard()
    checkId(id)
    return this.store().get(id, options.conflicts === true)
  }

  async put(document: NewDocument): Promise<{ id: string; rev: string }> {
    this.guard()
    checkId(document._id)
    return this.store().put(document)
  }

  async remove(id: string, rev: string): Promise<void> {
    this.guard()
    checkId(id)
    await this.store().remove(id, rev)
  }

  /** Every document, ordered by id. */
  async list(): Promise<StoredDocument[]> {
    this.guard()
    return this.store().list()
  }

  /** Calls the listener for every change from now on, local or synced in. Returns the stop function. */
  watch(listener: (change: DocumentChange) => void): () => void {
    this.guard()
    const cancel = this.store().watch((change) => {
      if (change.id.startsWith('_')) return
      try {
        listener(change)
      } catch {
        // a failing listener must not stop the feed
      }
    })
    const stop = (): void => {
      if (!this.feeds.delete(stop)) return
      cancel()
    }
    this.feeds.add(stop)
    return stop
  }

  /** Stops every watcher; the core calls it when it closes. */
  stopWatching(): void {
    for (const stop of [...this.feeds]) stop()
  }
}

function checkId(id: string): void {
  if (typeof id !== 'string' || id === '') throw new TypeError('A document needs an id')
  if (id.startsWith('_')) throw new TypeError(`Document ids starting with _ are reserved for the system: ${id}`)
}
