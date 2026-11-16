import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ChannelSink } from '../cluster/RelayHub.js'
import { parseAnnouncement, type ClusterDocument, type NodeAnnouncement } from '../cluster/ClusterDocument.js'
import { NODE_HEADER } from '../cluster/delegate.js'
import type { Frame } from '../cluster/frames.js'
import type { CouchRequest, CouchResponse } from '../database/couchApi.js'
import { HttpError, readJson, sendJson } from './http.js'
import type { Mount } from './HttpListenerPool.js'
import { pipeFrames, serveInvocation, type Invocation } from './invoke.js'

/** What the core serving a dataset provides to its endpoint. */
export interface EndpointHost {
  /** Browser origins allowed to call this endpoint; `*` allows any. */
  readonly origins: readonly string[]
  status(): Promise<{ cluster: ClusterDocument; online: readonly { id: string; since: string }[]; holdsData: boolean }>
  join(announcement: NodeAnnouncement): Promise<{ nodeId: string; cluster: unknown }>
  announce(nodeId: string, announcement: NodeAnnouncement): Promise<unknown>
  isMember(nodeId: string): boolean
  invoke(capabilityId: string): Invocation | undefined
  /** Answers a CouchDB API request: from the local copy, or relayed to a member holding the data. */
  database(request: CouchRequest, requester: string | undefined, signal: AbortSignal): Promise<CouchResponse>
  /** Opens a member's channel; undefined when this node takes no channels (it is not the orchestrator). */
  channel(nodeId: string, sink: ChannelSink): (() => void) | undefined
  heartbeat(nodeId: string): boolean
  reply(nodeId: string, requestId: string, frames: readonly Frame[]): boolean
  /** Relays a capability request to a member connected by its channel. */
  relay(nodeId: string, capabilityId: string, args: unknown, signal: AbortSignal): Promise<Response>
}

export class DatasetEndpoint implements Mount {
  private readonly name: string
  private readonly host: EndpointHost
  private readonly closing: AbortController

  constructor(name: string, host: EndpointHost) {
    this.name = name
    this.host = host
    this.closing = new AbortController()
  }

  allowsOrigin(origin: string): boolean {
    return this.host.origins.includes('*') || this.host.origins.includes(origin)
  }

  close(): void {
    this.closing.abort()
  }

  async handle(request: IncomingMessage, response: ServerResponse, path: readonly string[], query: URLSearchParams): Promise<void> {
    const method = request.method ?? 'GET'
    if (path[0] === '_minderal') return this.cluster(method, path.slice(1), query, request, response)
    const body = method === 'POST' || method === 'PUT' ? await readJson(request) : undefined
    const gone = new AbortController()
    response.on('close', () => gone.abort())
    const signal = AbortSignal.any([gone.signal, this.closing.signal])
    const requester = header(request, NODE_HEADER)
    const answer = this.host.database(
      { method, path, query: Object.fromEntries(query), ...(body === undefined ? {} : { body }) },
      requester,
      signal,
    )
    await sendCouchResponse(response, await withHeartbeat(answer, response, query))
  }

  private async cluster(
    method: string,
    path: readonly string[],
    query: URLSearchParams,
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const [action, ...rest] = path
    if (action === 'status' && rest.length === 0 && method === 'GET') {
      const { cluster, online, holdsData } = await this.host.status()
      return sendJson(response, 200, { dataset: cluster.dataset, nodes: cluster.nodes, online, holdsData })
    }
    if (action === 'join' && rest.length === 0 && method === 'POST') {
      const body = await readJson(request)
      const announcement = parse(() => parseAnnouncement(field(body, 'node')))
      const { nodeId, cluster } = await this.host.join(announcement)
      return sendJson(response, 201, { dataset: this.name.replace(/^minderal-/, ''), nodeId, cluster })
    }
    if (action === 'announce' && rest.length === 0 && method === 'POST') {
      const body = await readJson(request)
      const nodeId = field(body, 'nodeId')
      if (typeof nodeId !== 'string') throw new HttpError(400, 'bad_request', 'An announcement needs the nodeId')
      const announcement = parse(() => parseAnnouncement(field(body, 'node')))
      return sendJson(response, 200, { cluster: await this.host.announce(nodeId, announcement) })
    }
    if (action === 'invoke' && rest.length === 1 && method === 'POST') {
      this.requireMember(request)
      const invocation = this.host.invoke(rest[0] ?? '')
      if (invocation === undefined) throw new HttpError(404, 'capability_unavailable', `This node cannot perform ${rest[0]} for others`)
      return serveInvocation(invocation, request, response)
    }
    if (action === 'relay' && rest.length === 3 && rest[1] === 'invoke' && method === 'POST') {
      this.requireMember(request)
      const body = await readJson(request)
      const gone = new AbortController()
      response.on('close', () => gone.abort())
      const relayed = await this.host.relay(rest[0] ?? '', rest[2] ?? '', field(body, 'args'), gone.signal)
      return pipeResponse(relayed, response)
    }
    if (action === 'channel' && rest.length === 0 && method === 'GET') return this.openChannel(query, request, response)
    if (action === 'channel' && rest[0] === 'heartbeat' && method === 'POST') {
      const node = field(await readJson(request), 'node')
      if (typeof node !== 'string' || !this.host.heartbeat(node)) throw new HttpError(404, 'not_found', 'No open channel for this node')
      return sendJson(response, 200, { ok: true })
    }
    if (action === 'channel' && rest[0] === 'reply' && method === 'POST') {
      const body = await readJson(request)
      const node = field(body, 'node')
      const requestId = field(body, 'request')
      const frames = field(body, 'frames')
      if (typeof node !== 'string' || typeof requestId !== 'string' || !Array.isArray(frames)) {
        throw new HttpError(400, 'bad_request', 'A reply needs node, request and frames')
      }
      if (!this.host.reply(node, requestId, frames as Frame[])) throw new HttpError(410, 'gone', 'The request is over or was cancelled')
      return sendJson(response, 200, { ok: true })
    }
    throw new HttpError(404, 'not_found', 'Unknown path')
  }

  /** Keeps the response open as the member's channel: NDJSON messages, flushed as they are sent. */
  private openChannel(query: URLSearchParams, request: IncomingMessage, response: ServerResponse): void {
    const node = query.get('node')
    if (node === null || !this.host.isMember(node)) throw new HttpError(403, 'forbidden', 'Only nodes of this cluster may open a channel')
    let open = true
    const sink: ChannelSink = {
      send: (message) => {
        if (open) response.write(`${JSON.stringify(message)}\n`)
      },
      close: () => {
        if (!open) return
        open = false
        response.end()
      },
    }
    response.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' })
    const disconnect = this.host.channel(node, sink)
    if (disconnect === undefined) {
      sink.close()
      return
    }
    request.on('close', () => {
      open = false
      disconnect()
    })
  }

  private requireMember(request: IncomingMessage): void {
    const caller = header(request, NODE_HEADER)
    if (caller === undefined || !this.host.isMember(caller)) {
      throw new HttpError(403, 'forbidden', 'Only nodes of this cluster may delegate capabilities to it')
    }
  }
}

/**
 * Long-polls wait for a change before answering; a client that asked for heartbeats gets newlines
 * meanwhile, which commits the response to 200 before the answer is known, as CouchDB does too.
 */
async function withHeartbeat(answer: Promise<CouchResponse>, response: ServerResponse, query: URLSearchParams): Promise<CouchResponse> {
  const interval = Number(query.get('heartbeat'))
  if (query.get('feed') !== 'longpoll' || !(interval > 0)) return answer
  const beat = setInterval(() => {
    if (!response.headersSent) response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'must-revalidate' })
    response.write('\n')
  }, interval)
  const stop = (): void => clearInterval(beat)
  response.on('close', stop)
  try {
    return await answer
  } finally {
    stop()
    response.off('close', stop)
  }
}

async function sendCouchResponse(response: ServerResponse, answer: CouchResponse): Promise<void> {
  if (response.destroyed) return
  if (answer.bytes !== undefined) {
    if (!response.headersSent) response.writeHead(answer.status, { ...answer.headers })
    response.end(answer.bytes)
    return
  }
  sendJson(response, answer.status, answer.json)
}

async function pipeResponse(relayed: Response, response: ServerResponse): Promise<void> {
  if (relayed.status !== 200 || relayed.body === null) {
    sendJson(response, relayed.status, await relayed.json().catch(() => ({ error: 'unavailable' })))
    return
  }
  response.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' })
  const reader = relayed.body.getReader()
  await pipeFrames(
    (async function* () {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) return
          yield { raw: value, t: 'raw' }
        }
      } finally {
        await reader.cancel().catch(() => undefined)
      }
    })(),
    response,
  )
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return typeof value === 'string' ? value : undefined
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && name in body ? (body as Record<string, unknown>)[name] : undefined
}

function parse<Value>(read: () => Value): Value {
  try {
    return read()
  } catch (error) {
    throw new HttpError(400, 'bad_request', error instanceof Error ? error.message : String(error))
  }
}
