import type { IncomingMessage, ServerResponse } from 'node:http'
import { readClusterDocument } from '../cluster/clusterStorage.js'
import { HttpError, readJson, sendJson } from './http.js'
import type { Mount } from './HttpListenerPool.js'

const DEFAULT_LONGPOLL_TIMEOUT = 60_000
const MAX_LONGPOLL_TIMEOUT = 300_000
const CLUSTER_WRITE_FORBIDDEN = 'Cluster configuration is written by the orchestrator only'

type Document = Record<string, unknown> & { _id: string }

export class DatasetEndpoint implements Mount {
  private readonly database: PouchDB.Database
  private readonly datasetId: string
  private readonly name: string
  private readonly waiters: Set<() => void>

  constructor(database: PouchDB.Database, datasetId: string, name: string) {
    this.database = database
    this.datasetId = datasetId
    this.name = name
    this.waiters = new Set()
  }

  close(): void {
    for (const wake of [...this.waiters]) wake()
  }

  async handle(request: IncomingMessage, response: ServerResponse, path: readonly string[], query: URLSearchParams): Promise<void> {
    const method = request.method ?? 'GET'
    const [first, second, ...rest] = path
    if (first === undefined) return this.databaseInfo(method, response)
    if (first === '_local' || first === '_design') {
      if (second === undefined) throw new HttpError(404, 'not_found', 'Missing document id')
      const id = `${first}/${second}`
      if (rest.length > 0) return this.attachment(method, id, rest.join('/'), response, query)
      return this.document(method, id, request, response, query)
    }
    if (first === '_minderal') {
      if (second === 'status' && rest.length === 0 && method === 'GET') return this.status(response)
      throw new HttpError(404, 'not_found', 'Unknown path')
    }
    if (second !== undefined) {
      if (first.startsWith('_')) throw new HttpError(404, 'not_found', 'Unknown path')
      return this.attachment(method, first, [second, ...rest].join('/'), response, query)
    }
    switch (first) {
      case '_changes':
        if (method !== 'GET' && method !== 'POST') break
        return this.changes(request, response, query, method === 'POST' ? await readJson(request) : undefined)
      case '_revs_diff':
        if (method !== 'POST') break
        return sendJson(response, 200, await this.database.revsDiff(revsDiffRequest(await readJson(request))))
      case '_bulk_get':
        if (method !== 'POST') break
        return this.bulkGet(response, query, await readJson(request))
      case '_bulk_docs':
        if (method !== 'POST') break
        return this.bulkDocs(response, await readJson(request))
      case '_ensure_full_commit':
        if (method !== 'POST') break
        return sendJson(response, 201, { ok: true, instance_start_time: '0' })
      default:
        if (first.startsWith('_')) throw new HttpError(400, 'illegal_docid', 'Only reserved document ids may start with underscore.')
        return this.document(method, first, request, response, query)
    }
    throw new HttpError(405, 'method_not_allowed', `${method} is not allowed here`)
  }

  private async databaseInfo(method: string, response: ServerResponse): Promise<void> {
    if (method === 'GET' || method === 'HEAD') {
      const info = await this.database.info()
      return sendJson(response, 200, {
        db_name: this.name,
        doc_count: info.doc_count,
        update_seq: info.update_seq,
        instance_start_time: '0',
      })
    }
    if (method === 'PUT') throw new HttpError(412, 'file_exists', 'The database could not be created, the file already exists.')
    throw new HttpError(403, 'forbidden', 'Datasets are managed by their core')
  }

  private async status(response: ServerResponse): Promise<void> {
    const cluster = await readClusterDocument(this.database, this.datasetId)
    sendJson(response, 200, { dataset: cluster.dataset, nodes: cluster.nodes })
  }

  private async changes(request: IncomingMessage, response: ServerResponse, query: URLSearchParams, body: unknown): Promise<void> {
    const options = changesOptions(query, body)
    if (options.since === 'now') options.since = (await this.database.info()).update_seq
    let result = await this.database.changes(options)
    if (query.get('feed') === 'longpoll' && result.results.length === 0) {
      const heartbeat = positiveNumber(query.get('heartbeat'))
      let beat: ReturnType<typeof setInterval> | undefined
      if (heartbeat !== undefined) {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'must-revalidate' })
        beat = setInterval(() => response.write('\n'), heartbeat)
      }
      try {
        const timeout = Math.min(positiveNumber(query.get('timeout')) ?? DEFAULT_LONGPOLL_TIMEOUT, MAX_LONGPOLL_TIMEOUT)
        await this.waitForChange(options.since ?? 0, timeout, request)
      } finally {
        clearInterval(beat)
      }
      result = await this.database.changes(options)
    }
    sendJson(response, 200, result)
  }

  private async waitForChange(since: number | string, timeout: number, request: IncomingMessage): Promise<void> {
    await new Promise<void>((resolve) => {
      let done = false
      const feed = this.database.changes({ since, live: true })
      const wake = (): void => {
        if (done) return
        done = true
        clearTimeout(timer)
        feed.cancel()
        request.off('close', wake)
        this.waiters.delete(wake)
        resolve()
      }
      const timer = setTimeout(wake, timeout)
      feed.on('change', wake)
      feed.on('error', wake)
      request.on('close', wake)
      this.waiters.add(wake)
    })
  }

  private async bulkGet(response: ServerResponse, query: URLSearchParams, body: unknown): Promise<void> {
    const docs = bulkGetRequest(body)
    const options: PouchDB.Core.BulkGetOptions & { latest: boolean } = {
      docs,
      revs: flag(query, 'revs'),
      latest: flag(query, 'latest'),
      attachments: flag(query, 'attachments'),
      binary: false,
    }
    const result = await this.database.bulkGet(options)
    sendJson(response, 200, result)
  }

  private async bulkDocs(response: ServerResponse, body: unknown): Promise<void> {
    const { docs, newEdits } = bulkDocsRequest(body)
    const allowed = docs.filter((doc) => !doc._id.startsWith('_design/'))
    const forbidden = docs
      .filter((doc) => doc._id.startsWith('_design/'))
      .map((doc) => ({ id: doc._id, error: 'forbidden', reason: CLUSTER_WRITE_FORBIDDEN }))
    const written = allowed.length === 0 ? [] : await this.database.bulkDocs(allowed, { new_edits: newEdits })
    sendJson(response, 201, [...written, ...forbidden])
  }

  private async attachment(
    method: string,
    id: string,
    name: string,
    response: ServerResponse,
    query: URLSearchParams,
  ): Promise<void> {
    if (method !== 'GET' && method !== 'HEAD') {
      throw new HttpError(405, 'method_not_allowed', 'Attachments are read-only over HTTP; replicate documents instead')
    }
    const rev = query.get('rev')
    const options = rev === null ? {} : { rev }
    const document = await this.database.get(id, options)
    const stub = document._attachments?.[name]
    if (stub === undefined) throw new HttpError(404, 'not_found', 'Document is missing attachment')
    const content = await this.database.getAttachment(id, name, options)
    const bytes = content instanceof Uint8Array ? content : new Uint8Array(await content.arrayBuffer())
    response.writeHead(200, {
      'content-type': stub.content_type,
      'content-length': String(bytes.length),
      ...(stub.digest === undefined ? {} : { 'content-md5': stub.digest.replace(/^md5-/, '') }),
    })
    response.end(method === 'HEAD' ? undefined : bytes)
  }

  private async document(
    method: string,
    id: string,
    request: IncomingMessage,
    response: ServerResponse,
    query: URLSearchParams,
  ): Promise<void> {
    if (method === 'GET' || method === 'HEAD') {
      return sendJson(response, 200, await this.database.get(id, getOptions(query)))
    }
    if (method === 'PUT') {
      if (id.startsWith('_design/')) throw new HttpError(403, 'forbidden', CLUSTER_WRITE_FORBIDDEN)
      const body = await readJson(request)
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw new HttpError(400, 'bad_request', 'Document must be a JSON object')
      }
      const result = await this.database.put({ ...body, _id: id })
      return sendJson(response, 201, result)
    }
    throw new HttpError(405, 'method_not_allowed', `${method} is not allowed on documents`)
  }
}

function changesOptions(query: URLSearchParams, body: unknown): PouchDB.Core.ChangesOptions {
  const options: PouchDB.Core.ChangesOptions = { since: parseSince(query.get('since')), return_docs: true }
  if (query.get('style') === 'all_docs') options.style = 'all_docs'
  if (flag(query, 'include_docs')) options.include_docs = true
  if (flag(query, 'conflicts')) options.conflicts = true
  if (flag(query, 'attachments')) {
    options.attachments = true
    options.binary = false
  }
  if (flag(query, 'descending')) options.descending = true
  const limit = positiveNumber(query.get('limit'))
  if (limit !== undefined) options.limit = limit
  const filter = query.get('filter')
  if (filter === '_doc_ids') {
    options.doc_ids = docIds(body, query)
  } else if (filter !== null) {
    throw new HttpError(400, 'bad_request', `Filter ${filter} is not supported`)
  }
  return options
}

function parseSince(since: string | null): number | string {
  if (since === null || since === '') return 0
  if (since === 'now') return 'now'
  return /^\d+$/.test(since) ? Number(since) : since
}

function docIds(body: unknown, query: URLSearchParams): string[] {
  const fromBody = typeof body === 'object' && body !== null && 'doc_ids' in body ? body.doc_ids : undefined
  const raw = fromBody ?? parseJsonParameter(query.get('doc_ids'))
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string')) {
    throw new HttpError(400, 'bad_request', 'doc_ids must be a list of strings')
  }
  return raw
}

function getOptions(query: URLSearchParams): PouchDB.Core.GetOptions & { open_revs?: 'all' | string[]; latest?: boolean } {
  const options: PouchDB.Core.GetOptions & { open_revs?: 'all' | string[]; latest?: boolean } = { binary: false }
  const rev = query.get('rev')
  if (rev !== null) options.rev = rev
  if (flag(query, 'revs')) options.revs = true
  if (flag(query, 'revs_info')) options.revs_info = true
  if (flag(query, 'conflicts')) options.conflicts = true
  if (flag(query, 'attachments')) options.attachments = true
  if (flag(query, 'latest')) options.latest = true
  const openRevs = query.get('open_revs')
  if (openRevs !== null) {
    const parsed = openRevs === 'all' ? 'all' : parseJsonParameter(openRevs)
    if (parsed !== 'all' && !(Array.isArray(parsed) && parsed.every((value) => typeof value === 'string'))) {
      throw new HttpError(400, 'bad_request', 'open_revs must be "all" or a list of revisions')
    }
    options.open_revs = parsed
  }
  return options
}

function revsDiffRequest(body: unknown): Record<string, string[]> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'bad_request', '_revs_diff expects an object of id to revisions')
  }
  const diff: Record<string, string[]> = {}
  for (const [id, revs] of Object.entries(body)) {
    if (!Array.isArray(revs) || !revs.every((rev) => typeof rev === 'string')) {
      throw new HttpError(400, 'bad_request', `Revisions of ${id} must be a list of strings`)
    }
    diff[id] = revs
  }
  return diff
}

function bulkGetRequest(body: unknown): { id: string; rev?: string }[] {
  const docs = typeof body === 'object' && body !== null && 'docs' in body ? body.docs : undefined
  if (!Array.isArray(docs)) throw new HttpError(400, 'bad_request', '_bulk_get expects { docs: [...] }')
  return docs.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || !('id' in entry) || typeof entry.id !== 'string') {
      throw new HttpError(400, 'bad_request', 'Every _bulk_get entry needs an id')
    }
    if ('rev' in entry && typeof entry.rev === 'string') return { id: entry.id, rev: entry.rev }
    return { id: entry.id }
  })
}

function bulkDocsRequest(body: unknown): { docs: Document[]; newEdits: boolean } {
  if (typeof body !== 'object' || body === null || !('docs' in body) || !Array.isArray(body.docs)) {
    throw new HttpError(400, 'bad_request', '_bulk_docs expects { docs: [...] }')
  }
  const newEdits = !('new_edits' in body) || body.new_edits !== false
  const docs = body.docs.map((doc: unknown): Document => {
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      throw new HttpError(400, 'bad_request', 'Every document must be a JSON object')
    }
    const id = '_id' in doc ? doc._id : undefined
    if (typeof id !== 'string') throw new HttpError(400, 'bad_request', 'Every document needs an _id')
    return { ...doc, _id: id }
  })
  return { docs, newEdits }
}

function flag(query: URLSearchParams, name: string): boolean {
  return query.get(name) === 'true'
}

function positiveNumber(value: string | null): number | undefined {
  if (value === null) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseJsonParameter(value: string | null): unknown {
  if (value === null) return undefined
  try {
    return JSON.parse(value)
  } catch {
    throw new HttpError(400, 'bad_request', 'Query parameter is not valid JSON')
  }
}
