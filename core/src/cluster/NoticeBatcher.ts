import type { WrittenChange } from '../database/couchApi.js'

export const NOTICE_DELAY_MS = 100
export const NOTICE_MAX_CHANGES = 200

/**
 * Gathers the writes a node applies over a short window and hands them on in batches, so a burst — a
 * replication batch, a loop of puts — becomes a few notices instead of one per document. A document
 * written twice in a window is told once, with its last state. Batches never exceed `maxChanges`.
 */
export class NoticeBatcher {
  private readonly send: (changes: WrittenChange[]) => Promise<void>
  private readonly delayMs: number
  private readonly maxChanges: number
  private pending: Map<string, boolean>
  private timer: ReturnType<typeof setTimeout> | undefined
  private flushing: Promise<void>
  private closed: boolean

  constructor(send: (changes: WrittenChange[]) => Promise<void>, delayMs = NOTICE_DELAY_MS, maxChanges = NOTICE_MAX_CHANGES) {
    this.send = send
    this.delayMs = delayMs
    this.maxChanges = maxChanges
    this.pending = new Map()
    this.flushing = Promise.resolve()
    this.closed = false
  }

  add(changes: readonly WrittenChange[]): void {
    if (this.closed || changes.length === 0) return
    for (const change of changes) {
      this.pending.delete(change.id)
      this.pending.set(change.id, change.deleted)
    }
    this.timer ??= setTimeout(() => this.flush(), this.delayMs)
  }

  /** Sends what is gathered now; resolves once every batch so far went out. */
  async flush(): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    const changes = [...this.pending].map(([id, deleted]) => ({ id, deleted }))
    this.pending = new Map()
    for (let start = 0; start < changes.length; start += this.maxChanges) {
      const batch = changes.slice(start, start + this.maxChanges)
      this.flushing = this.flushing.then(async () => this.send(batch)).catch(() => undefined)
    }
    await this.flushing
  }

  /** Drops whatever is gathered; nothing is sent afterwards. */
  close(): void {
    this.closed = true
    clearTimeout(this.timer)
    this.timer = undefined
    this.pending = new Map()
  }
}
