import { CouchError } from './CouchError.js'

/**
 * The part of CouchDB's HTTP API that replication uses, over a PouchDB database, in any runtime. A
 * Node.js core answers it over HTTP; a browser holding the data answers it through the relay, for an
 * orchestrator that holds none.
 */
export interface CouchRequest {
  readonly method: string
  /** Path inside the database, decoded: `['_changes']`, `['doc-id', 'attachment.png']`. */
  readonly path: readonly string[]
  readonly query: Readonly<Record<string, string>>
  readonly body?: unknown
}

export interface CouchResponse {
  readonly status: number
  readonly json?: unknown
  readonly bytes?: Uint8Array
  readonly headers?: Readonly<Record<string, string>>
}

const DEFAULT_LONGPOLL_TIMEOUT = 60_000
const MAX_LONGPOLL_TIMEOUT = 300_000
export const CLUSTER_WRITE_FORBIDDEN = 'Cluster configuration is written by the orchestrator only'

type Document = Record<string, unknown> & { _id: string }

export interface CouchContext {
  readonly database: PouchDB.Database
  /** The database name to report, `minderal-<id>`. */
  readonly name: string
  /** Aborts a long-poll wait: the requester went away or the endpoint is closing. */
  readonly signal?: AbortSignal
}

/** Answers one request. Errors the API defines come back as responses; anything else throws. */
export async function handleCouchRequest(context: CouchContext, request: CouchRequest): Promise<CouchResponse> {
  try {
    return await route(context, request)
  } catch (error) {
    return errorResponse(error)
  }
}

export function errorResponse(error: unknown): CouchResponse {
  if (error instanceof CouchError) return { status: error.status, json: { error: error.error, reason: error.message } }
  const status = typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number' ? error.status : 500
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : 'unknown_error'
  const reason = error instanceof Error ? error.message : String(error)
  return { status, json: { error: name, reason } }
}

async function route(context: CouchContext, request: CouchRequest): Promise<CouchResponse> {
  const { database } = context
  const method = request.method
  const query = new Map(Object.entries(request.query))
  const [first, second, ...rest] = request.path
  if (first === undefined) return databaseInfo(context, method)
  if (first === '_local' || first === '_design') {
    if (second === undefined) throw new CouchError(404, 'not_found', 'Missing document id')
    const id = `${first}/${second}`
    if (rest.length > 0) return attachment(database, method, id, rest.join('/'), query)
    return documentRequest(database, method, id, request.body, query)
  }
  if (second !== undefined) {
    if (first.startsWith('_')) throw new CouchError(404, 'not_found', 'Unknown path')
    return attachment(database, method, first, [second, ...rest].join('/'), query)
  }
  switch (first) {
    case '_changes':
      if (method !== 'GET' && method !== 'POST') break
      return changes(context, query, method === 'POST' ? request.body : undefined)
    case '_revs_diff':
      if (method !== 'POST') break
      return { status: 200, json: await database.revsDiff(revsDiffRequest(request.body)) }
    case '_bulk_get':
      if (method !== 'POST') break
      return bulkGet(database, query, request.body)
    case '_bulk_docs':
      if (method !== 'POST') break
      return bulkDocs(database, request.body)
    case '_ensure_full_commit':
      if (method !== 'POST') break
      return { status: 201, json: { ok: true, instance_start_time: '0' } }
    default:
      if (first.startsWith('_')) throw new CouchError(400, 'illegal_docid', 'Only reserved document ids may start with underscore.')
      return documentRequest(database, method, first, request.body, query)
  }
  throw new CouchError(405, 'method_not_allowed', `${method} is not allowed here`)
}

async function databaseInfo(context: CouchContext, method: string): Promise<CouchResponse> {
  if (method === 'GET' || method === 'HEAD') {
    const info = await context.database.info()
    return {
      status: 200,
      json: { db_name: context.name, doc_count: info.doc_count, update_seq: info.update_seq, instance_start_time: '0' },
    }
  }
  if (method === 'PUT') throw new CouchError(412, 'file_exists', 'The database could not be created, the file already exists.')
  throw new CouchError(403, 'forbidden', 'Datasets are managed by their core')
}

async function changes(context: CouchContext, query: Map<string, string>, body: unknown): Promise<CouchResponse> {
  const { database } = context
  const options = changesOptions(query, body)
  if (options.since === 'now') options.since = (await database.info()).update_seq
  let result = await database.changes(options)
  if (query.get('feed') === 'longpoll' && result.results.length === 0) {
    const timeout = Math.min(positiveNumber(query.get('timeout')) ?? DEFAULT_LONGPOLL_TIMEOUT, MAX_LONGPOLL_TIMEOUT)
    await waitForChange(database, options.since ?? 0, timeout, context.signal)
    // the requester left or the endpoint is closing, and with it maybe the database: answer nothing new
    if (context.signal?.aborted === true) return { status: 200, json: { results: [], last_seq: options.since ?? 0 } }
    result = await database.changes(options)
  }
  return { status: 200, json: result }
}

async function waitForChange(database: PouchDB.Database, since: number | string, timeout: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted === true) return
  await new Promise<void>((resolve) => {
    let done = false
    const feed = database.changes({ since, live: true })
    const wake = (): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      feed.cancel()
      signal?.removeEventListener('abort', wake)
      resolve()
    }
    const timer = setTimeout(wake, timeout)
    feed.on('change', wake)
    feed.on('error', wake)
    signal?.addEventListener('abort', wake)
  })
}

async function bulkGet(database: PouchDB.Database, query: Map<string, string>, body: unknown): Promise<CouchResponse> {
  const options: PouchDB.Core.BulkGetOptions & { latest: boolean } = {
    docs: bulkGetRequest(body),
    revs: flag(query, 'revs'),
    latest: flag(query, 'latest'),
    attachments: flag(query, 'attachments'),
    binary: false,
  }
  return { status: 200, json: await database.bulkGet(options) }
}

async function bulkDocs(database: PouchDB.Database, body: unknown): Promise<CouchResponse> {
  const { docs, newEdits } = bulkDocsRequest(body)
  const allowed = docs.filter((doc) => !doc._id.startsWith('_design/'))
  const forbidden = docs
    .filter((doc) => doc._id.startsWith('_design/'))
    .map((doc) => ({ id: doc._id, error: 'forbidden', reason: CLUSTER_WRITE_FORBIDDEN }))
  const written = allowed.length === 0 ? [] : await database.bulkDocs(allowed, { new_edits: newEdits })
  return { status: 201, json: [...written, ...forbidden] }
}

async function attachment(
  database: PouchDB.Database,
  method: string,
  id: string,
  name: string,
  query: Map<string, string>,
): Promise<CouchResponse> {
  if (method !== 'GET' && method !== 'HEAD') {
    throw new CouchError(405, 'method_not_allowed', 'Attachments are read-only over HTTP; replicate documents instead')
  }
  const rev = query.get('rev')
  const options = rev === undefined ? {} : { rev }
  const document = await database.get(id, options)
  const stub = document._attachments?.[name]
  if (stub === undefined) throw new CouchError(404, 'not_found', 'Document is missing attachment')
  const content = await database.getAttachment(id, name, options)
  const bytes = content instanceof Uint8Array ? new Uint8Array(content) : new Uint8Array(await content.arrayBuffer())
  return {
    status: 200,
    bytes: method === 'HEAD' ? new Uint8Array() : bytes,
    headers: {
      'content-type': stub.content_type,
      'content-length': String(bytes.length),
      ...(stub.digest === undefined ? {} : { 'content-md5': stub.digest.replace(/^md5-/, '') }),
    },
  }
}

async function documentRequest(
  database: PouchDB.Database,
  method: string,
  id: string,
  body: unknown,
  query: Map<string, string>,
): Promise<CouchResponse> {
  if (method === 'GET' || method === 'HEAD') return { status: 200, json: await database.get(id, getOptions(query)) }
  if (method === 'PUT') {
    if (id.startsWith('_design/')) throw new CouchError(403, 'forbidden', CLUSTER_WRITE_FORBIDDEN)
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new CouchError(400, 'bad_request', 'Document must be a JSON object')
    }
    return { status: 201, json: await database.put({ ...body, _id: id }) }
  }
  throw new CouchError(405, 'method_not_allowed', `${method} is not allowed on documents`)
}

function changesOptions(query: Map<string, string>, body: unknown): PouchDB.Core.ChangesOptions {
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
  } else if (filter !== undefined) {
    throw new CouchError(400, 'bad_request', `Filter ${filter} is not supported`)
  }
  return options
}

function parseSince(since: string | undefined): number | string {
  if (since === undefined || since === '') return 0
  if (since === 'now') return 'now'
  return /^\d+$/.test(since) ? Number(since) : since
}

function docIds(body: unknown, query: Map<string, string>): string[] {
  const fromBody = typeof body === 'object' && body !== null && 'doc_ids' in body ? body.doc_ids : undefined
  const raw = fromBody ?? parseJsonParameter(query.get('doc_ids'))
  if (!Array.isArray(raw) || !raw.every((id) => typeof id === 'string')) {
    throw new CouchError(400, 'bad_request', 'doc_ids must be a list of strings')
  }
  return raw
}

function getOptions(query: Map<string, string>): PouchDB.Core.GetOptions & { open_revs?: 'all' | string[]; latest?: boolean } {
  const options: PouchDB.Core.GetOptions & { open_revs?: 'all' | string[]; latest?: boolean } = { binary: false }
  const rev = query.get('rev')
  if (rev !== undefined) options.rev = rev
  if (flag(query, 'revs')) options.revs = true
  if (flag(query, 'revs_info')) options.revs_info = true
  if (flag(query, 'conflicts')) options.conflicts = true
  if (flag(query, 'attachments')) options.attachments = true
  if (flag(query, 'latest')) options.latest = true
  const openRevs = query.get('open_revs')
  if (openRevs !== undefined) {
    const parsed = openRevs === 'all' ? 'all' : parseJsonParameter(openRevs)
    if (parsed !== 'all' && !(Array.isArray(parsed) && parsed.every((value) => typeof value === 'string'))) {
      throw new CouchError(400, 'bad_request', 'open_revs must be "all" or a list of revisions')
    }
    options.open_revs = parsed
  }
  return options
}

function revsDiffRequest(body: unknown): Record<string, string[]> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new CouchError(400, 'bad_request', '_revs_diff expects an object of id to revisions')
  }
  const diff: Record<string, string[]> = {}
  for (const [id, revs] of Object.entries(body)) {
    if (!Array.isArray(revs) || !revs.every((rev) => typeof rev === 'string')) {
      throw new CouchError(400, 'bad_request', `Revisions of ${id} must be a list of strings`)
    }
    diff[id] = revs
  }
  return diff
}

function bulkGetRequest(body: unknown): { id: string; rev?: string }[] {
  const docs = typeof body === 'object' && body !== null && 'docs' in body ? body.docs : undefined
  if (!Array.isArray(docs)) throw new CouchError(400, 'bad_request', '_bulk_get expects { docs: [...] }')
  return docs.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null || !('id' in entry) || typeof entry.id !== 'string') {
      throw new CouchError(400, 'bad_request', 'Every _bulk_get entry needs an id')
    }
    if ('rev' in entry && typeof entry.rev === 'string') return { id: entry.id, rev: entry.rev }
    return { id: entry.id }
  })
}

function bulkDocsRequest(body: unknown): { docs: Document[]; newEdits: boolean } {
  if (typeof body !== 'object' || body === null || !('docs' in body) || !Array.isArray(body.docs)) {
    throw new CouchError(400, 'bad_request', '_bulk_docs expects { docs: [...] }')
  }
  const newEdits = !('new_edits' in body) || body.new_edits !== false
  const docs = body.docs.map((doc: unknown): Document => {
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      throw new CouchError(400, 'bad_request', 'Every document must be a JSON object')
    }
    const id = '_id' in doc ? doc._id : undefined
    if (typeof id !== 'string') throw new CouchError(400, 'bad_request', 'Every document needs an _id')
    return { ...doc, _id: id }
  })
  return { docs, newEdits }
}

function flag(query: Map<string, string>, name: string): boolean {
  return query.get(name) === 'true'
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function parseJsonParameter(value: string | undefined): unknown {
  if (value === undefined) return undefined
  try {
    return JSON.parse(value)
  } catch {
    throw new CouchError(400, 'bad_request', 'Query parameter is not valid JSON')
  }
}
