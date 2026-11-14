export type ReplicationStatus = 'catching-up' | 'live' | 'stopped' | 'error'

export type ReplicationStatusListener = (status: ReplicationStatus, cause: unknown) => void

export interface ReplicationOptions {
  live?: boolean
  retry?: boolean
}

// The structural shape of PouchDB's sync handle, declared with method syntax
// so its own overloads stay assignable to it.
interface ReplicationHandle {
  cancel(): void
  on(event: 'active', listener: () => void): unknown
  on(event: 'paused', listener: (cause?: unknown) => void): unknown
  on(event: 'denied', listener: (cause: unknown) => void): unknown
  on(event: 'error', listener: (cause: unknown) => void): unknown
  on(event: 'complete', listener: (info: unknown) => void): unknown
}

export class Replication {
  private readonly handle: ReplicationHandle
  private readonly listeners: Set<ReplicationStatusListener>
  private currentStatus: ReplicationStatus

  private constructor(handle: ReplicationHandle) {
    this.handle = handle
    this.listeners = new Set()
    this.currentStatus = 'catching-up'
  }

  static start(handle: ReplicationHandle): Replication {
    const replication = new Replication(handle)

    // PouchDB pauses with no error once the backlog has drained, which is the
    // only signal that a freshly seeded local copy is whole.
    handle.on('paused', (cause) => {
      replication.moveTo(cause === undefined || cause === null ? 'live' : 'error', cause)
    })
    handle.on('active', () => replication.moveTo('catching-up', null))
    handle.on('denied', (cause) => replication.moveTo('error', cause))
    handle.on('error', (cause) => replication.moveTo('error', cause))
    handle.on('complete', () => replication.moveTo('stopped', null))

    return replication
  }

  get status(): ReplicationStatus {
    return this.currentStatus
  }

  get isCaughtUp(): boolean {
    return this.currentStatus === 'live'
  }

  onStatusChange(listener: ReplicationStatusListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  stop(): void {
    this.handle.cancel()
    this.moveTo('stopped', null)
  }

  private moveTo(status: ReplicationStatus, cause: unknown): void {
    if (this.currentStatus === status) return
    this.currentStatus = status
    for (const listener of this.listeners) listener(status, cause)
  }
}

export type { ReplicationHandle }
