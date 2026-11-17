import type { CouchRequest, CouchResponse } from '../database/couchApi.js'
import { DocumentConflictError, StorageError } from '../errors.js'
import { byId, type DocumentStore } from './DocumentStore.js'
import type { StoredDocument } from './Documents.js'

/** Performs a CouchDB API request on a node holding the data, saying which node answered. */
export type AskCluster = (request: CouchRequest, signal?: AbortSignal) => Promise<{ response: CouchResponse; servedBy: string }>

const WATCH_TIMEOUT_MS = 25_000
const WATCH_RETRY_MS = 2_000

/**
 * Documents of a core without a copy — client mode, or an orchestrator holding no data. Every call is
 * a `database@1` request to a node holding the data. Those nodes may come and go: their errors surface
 * as they are — CapabilityUnavailableError when none can be reached, PartialResultError,
 * DelegationError — and a refusal or conflict from the data itself as StorageError or
 * DocumentConflictError, like local storage.
 */
export function clusterStore(ask: AskCluster, datasetId: string): DocumentStore {
  async function request(request: CouchRequest, action: string): Promise<CouchResponse> {
    const { response } = await ask(request)
    if (response.status === 409) throw new DocumentConflictError(datasetId, request.path[0] ?? '')
    if (response.status >= 400 && response.status !== 404) throw new StorageError(datasetId, action, response.json)
    return response
  }

  return {
    async get(id, conflicts) {
      const response = await request({ method: 'GET', path: [id], query: conflicts ? { conflicts: 'true' } : {} }, `read document ${id}`)
      return response.status === 404 ? undefined : (response.json as StoredDocument)
    },

    async put(document) {
      const response = await request({ method: 'PUT', path: [document._id], query: {}, body: document }, `write document ${document._id}`)
      if (response.status === 404) throw new StorageError(datasetId, `write document ${document._id}`, response.json)
      const { id, rev } = response.json as { id: string; rev: string }
      return { id, rev }
    },

    async remove(id, rev) {
      const response = await request({ method: 'PUT', path: [id], query: {}, body: { _id: id, _rev: rev, _deleted: true } }, `remove document ${id}`)
      if (response.status === 404) throw new StorageError(datasetId, `remove document ${id}`, response.json)
    },

    /**
     * The changes feed with documents: part of the replication API every holder answers, so listing
     * needs nothing more of them. Reads the whole dataset; fine for now, paged later.
     */
    async list() {
      const response = await request({ method: 'GET', path: ['_changes'], query: { include_docs: 'true' } }, 'list documents')
      const results = (response.json as { results?: { id: string; deleted?: boolean; doc?: StoredDocument }[] }).results ?? []
      return results
        .flatMap((change) => (change.deleted === true || change.id.startsWith('_') || change.doc === undefined ? [] : [change.doc]))
        .sort(byId)
    },

    /**
     * Long-polls the changes feed through the cluster. Sequences belong to the node answering, so when
     * a different node answers, the watch starts over from that node's present: changes made during the
     * switch may be missed, never repeated.
     */
    watch(listener) {
      const stopped = new AbortController()
      void (async () => {
        let since = 'now'
        let node: string | undefined
        while (!stopped.signal.aborted) {
          try {
            const { response, servedBy: answeredBy } = await ask(
              { method: 'GET', path: ['_changes'], query: { feed: 'longpoll', since, timeout: String(WATCH_TIMEOUT_MS) } },
              stopped.signal,
            )
            if (stopped.signal.aborted) return
            const body = response.json as { results?: { id: string; deleted?: boolean }[]; last_seq?: unknown }
            if (response.status !== 200) throw new Error(`changes answered ${response.status}`)
            if (node !== undefined && answeredBy !== node) {
              node = answeredBy
              since = 'now'
              continue
            }
            node = answeredBy
            for (const change of body.results ?? []) listener({ id: change.id, deleted: change.deleted === true })
            since = String(body.last_seq ?? since)
          } catch {
            node = undefined
            since = 'now'
            await pause(WATCH_RETRY_MS, stopped.signal)
          }
        }
      })()
      return () => stopped.abort()
    },
  }
}

async function pause(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms)
    function done(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done)
  })
}
