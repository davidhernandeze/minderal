import { isSeq, type ChangeNotice, type Seq } from '../cluster/channel.js'
import type { CouchRequest, CouchResponse } from '../database/couchApi.js'
import { DocumentConflictError, StorageError } from '../errors.js'
import { byId, type DocumentStore } from './DocumentStore.js'
import type { StoredDocument } from './Dataset.js'

/**
 * Performs a CouchDB API request on a node holding the data — `node` when given, else whichever
 * answers — saying which node answered.
 */
export type AskCluster = (
  request: CouchRequest,
  signal?: AbortSignal,
  node?: string,
) => Promise<{ response: CouchResponse; servedBy: string }>

/** What reaches this core about changes elsewhere: notices, and that its channel came back after a gap. */
export type NoticeEvent = { readonly t: 'notice'; readonly notice: ChangeNotice } | { readonly t: 'reconnected' }

/** Subscribes to notice events; returns the unsubscribe function. */
export type NoticeSource = (listener: (event: NoticeEvent) => void) => () => void

/**
 * Documents of a core without a copy — client mode, or an orchestrator holding no data. Every call is
 * a `database@1` request to a node holding the data. Those nodes may come and go: their errors surface
 * as they are — CapabilityUnavailableError when none can be reached, PartialResultError,
 * DelegationError — and a refusal or conflict from the data itself as StorageError or
 * DocumentConflictError, like local storage.
 */
export function clusterStore(ask: AskCluster, notices: NoticeSource, datasetId: string): DocumentStore {
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
     * Change notices from the cluster, with no request held open: each notice names the documents a
     * node holding the data changed. After this core's channel comes back, it asks each node it heard
     * from for what changed meanwhile, so a disconnect loses nothing — a change may then be told twice.
     */
    watch(listener) {
      const stopped = new AbortController()
      const heard = new Map<string, Seq>()
      const catchUp = async (node: string, since: Seq): Promise<void> => {
        try {
          const { response } = await ask({ method: 'GET', path: ['_changes'], query: { since: String(since) } }, stopped.signal, node)
          if (stopped.signal.aborted || response.status !== 200) return
          const body = response.json as { results?: { id: string; deleted?: boolean }[]; last_seq?: unknown }
          for (const change of body.results ?? []) listener({ id: change.id, deleted: change.deleted === true })
          if (isSeq(body.last_seq) && heard.get(node) === since) heard.set(node, body.last_seq)
        } catch {
          // the node is gone again; its next notice tells what changes from there
        }
      }
      const unsubscribe = notices((event) => {
        if (event.t === 'reconnected') {
          for (const [node, since] of heard) void catchUp(node, since)
          return
        }
        heard.set(event.notice.node, event.notice.seq)
        for (const change of event.notice.changes) listener(change)
      })
      return () => {
        stopped.abort()
        unsubscribe()
      }
    },
  }
}
