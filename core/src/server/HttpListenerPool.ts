import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { HttpError, sendError, sendJson } from './http.js'

export interface Mount {
  handle(request: IncomingMessage, response: ServerResponse, path: readonly string[], query: URLSearchParams): Promise<void>
  allowsOrigin(origin: string): boolean
  close(): void
}

const CORS_MAX_AGE_SECONDS = 600

class Listener {
  readonly server: Server
  readonly port: number
  readonly uuid: string
  readonly mounts: Map<string, Mount>
  references: number

  constructor(server: Server, port: number) {
    this.server = server
    this.port = port
    this.uuid = crypto.randomUUID().replaceAll('-', '')
    this.mounts = new Map()
    this.references = 0
  }
}

export class HttpListenerPool {
  private readonly listeners: Map<string, Promise<Listener>>

  constructor() {
    this.listeners = new Map()
  }

  async acquire(host: string, port: number): Promise<ListenerHandle> {
    let pending = port === 0 ? undefined : this.listeners.get(`${host}:${port}`)
    if (pending === undefined) {
      pending = this.listen(host, port)
      if (port !== 0) this.listeners.set(`${host}:${port}`, pending)
      pending.then(
        (listener) => this.listeners.set(`${host}:${listener.port}`, Promise.resolve(listener)),
        () => this.listeners.delete(`${host}:${port}`),
      )
    }
    const listener = await pending
    listener.references += 1
    return new ListenerHandle(listener, async () => this.release(`${host}:${listener.port}`, listener))
  }

  private async listen(host: string, port: number): Promise<Listener> {
    let listener: Listener | undefined
    const server = createServer((request, response) => {
      if (listener !== undefined) void route(listener, request, response)
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.off('error', reject)
        resolve()
      })
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('HTTP listener has no port')
    listener = new Listener(server, address.port)
    return listener
  }

  private async release(key: string, listener: Listener): Promise<void> {
    listener.references -= 1
    if (listener.references > 0) return
    this.listeners.delete(key)
    for (const mount of listener.mounts.values()) mount.close()
    listener.mounts.clear()
    listener.server.closeAllConnections()
    await new Promise<void>((resolve) => {
      listener.server.close(() => resolve())
    })
  }
}

export class ListenerHandle {
  readonly port: number
  private readonly listener: Listener
  private releaseOnce: (() => Promise<void>) | undefined

  constructor(listener: Listener, release: () => Promise<void>) {
    this.listener = listener
    this.port = listener.port
    this.releaseOnce = release
  }

  mount(name: string, mount: Mount): void {
    if (this.listener.mounts.has(name)) throw new Error(`${name} is already served on port ${this.port}`)
    this.listener.mounts.set(name, mount)
  }

  unmount(name: string): void {
    this.listener.mounts.get(name)?.close()
    this.listener.mounts.delete(name)
  }

  async release(): Promise<void> {
    const release = this.releaseOnce
    this.releaseOnce = undefined
    if (release !== undefined) await release()
  }
}

async function route(listener: Listener, request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost')
    const path = url.pathname.split('/').filter((segment) => segment !== '').map(decodeURIComponent)
    const [name, ...rest] = path
    const mount = name === undefined ? undefined : listener.mounts.get(name)
    if (!applyCors(listener, mount, request, response)) return
    if (name === undefined) {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Only GET is allowed')
      sendJson(response, 200, { couchdb: 'Welcome', version: '3.4.0', vendor: { name: 'minderal' }, uuid: listener.uuid })
      return
    }
    if (mount === undefined) throw new HttpError(404, 'not_found', 'Database does not exist.')
    await mount.handle(request, response, rest, url.searchParams)
  } catch (error) {
    sendError(response, error)
  }
}

/**
 * Cross-origin access for browser nodes. A dataset's own paths follow its mount's allowed origins; the
 * server root, which replicators read for the server's identity, follows any mount's. Returns false when
 * the request was a preflight and has been answered.
 */
function applyCors(listener: Listener, mount: Mount | undefined, request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin
  if (origin === undefined) return true
  const allowed =
    mount === undefined ? [...listener.mounts.values()].some((candidate) => candidate.allowsOrigin(origin)) : mount.allowsOrigin(origin)
  response.setHeader('vary', 'Origin')
  if (allowed) {
    response.setHeader('access-control-allow-origin', origin)
    response.setHeader('access-control-allow-credentials', 'true')
  }
  if (request.method !== 'OPTIONS' || request.headers['access-control-request-method'] === undefined) return true
  if (!allowed) {
    response.writeHead(403)
    response.end()
    return false
  }
  response.setHeader('access-control-allow-methods', 'GET, HEAD, POST, PUT, DELETE')
  const headers = request.headers['access-control-request-headers']
  if (headers !== undefined) response.setHeader('access-control-allow-headers', headers)
  if (request.headers['access-control-request-private-network'] === 'true') {
    response.setHeader('access-control-allow-private-network', 'true')
  }
  response.setHeader('access-control-max-age', String(CORS_MAX_AGE_SECONDS))
  response.writeHead(204)
  response.end()
  return false
}
