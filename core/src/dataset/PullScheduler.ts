/**
 * One-shot pulls into the core's copy, one source at a time: a pull asked for while one from the same
 * source runs is folded into a single follow-up run, so a burst of notices costs at most two pulls.
 * Each source is a CouchDB-shaped URL; replication checkpoints are kept per source, so pulling from
 * several holders never confuses their changes feeds.
 */
export class PullScheduler {
  private readonly database: PouchDB.Database
  private readonly open: (url: string) => PouchDB.Database
  private readonly onPulled: (url: string, written: number) => void
  private readonly sources: Map<string, Source>
  private closed: boolean

  constructor(database: PouchDB.Database, open: (url: string) => PouchDB.Database, onPulled: (url: string, written: number) => void = () => undefined) {
    this.database = database
    this.open = open
    this.onPulled = onPulled
    this.sources = new Map()
    this.closed = false
  }

  /** Pulls from a source soon. Failures are dropped: the next notice or catch-up pulls again. */
  request(url: string): void {
    if (this.closed) return
    let source = this.sources.get(url)
    if (source === undefined) {
      source = { running: undefined, again: false, cancel: undefined }
      this.sources.set(url, source)
    }
    if (source.running !== undefined) {
      source.again = true
      return
    }
    source.running = this.run(url, source)
  }

  /** Resolves once no pull runs or is due; for tests and an explicit catch-up. */
  async idle(): Promise<void> {
    while (true) {
      const running = [...this.sources.values()].flatMap((source) => (source.running === undefined ? [] : [source.running]))
      if (running.length === 0) return
      await Promise.allSettled(running)
    }
  }

  async close(): Promise<void> {
    this.closed = true
    for (const source of this.sources.values()) {
      source.again = false
      source.cancel?.()
    }
    const running = [...this.sources.values()].flatMap((source) => (source.running === undefined ? [] : [source.running]))
    await Promise.race([Promise.allSettled(running), new Promise((resolve) => setTimeout(resolve, 2000))])
  }

  private async run(url: string, source: Source): Promise<void> {
    try {
      do {
        source.again = false
        const remote = withQuietInfo(this.open(url))
        try {
          const replication = this.database.replicate.from(remote)
          source.cancel = () => replication.cancel()
          const result = await replication
          if (!this.closed) this.onPulled(url, result.docs_written)
        } catch {
          // unreachable, or no holder online: a later notice or catch-up retries
        } finally {
          source.cancel = undefined
          await remote.close().catch(() => undefined)
        }
      } while (source.again && !this.closed)
    } finally {
      source.running = undefined
    }
  }
}

interface Source {
  running: Promise<void> | undefined
  again: boolean
  cancel: (() => void) | undefined
}

/**
 * PouchDB's replication asks its source for `info()` after each batch, only to report progress, and
 * never handles that promise failing: a source going away mid-pull would surface as an unhandled
 * rejection. Progress is not needed here, so a failed `info()` answers empty; the pull itself still
 * fails on its next real request.
 */
function withQuietInfo(remote: PouchDB.Database): PouchDB.Database {
  const info = remote.info.bind(remote)
  const quiet = async (): Promise<PouchDB.Core.DatabaseInfo> => {
    try {
      return await info()
    } catch {
      return { db_name: remote.name, doc_count: 0, update_seq: 0 }
    }
  }
  Object.defineProperty(remote, 'info', { value: quiet, configurable: true })
  return remote
}
