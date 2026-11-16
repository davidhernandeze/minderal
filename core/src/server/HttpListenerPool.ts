import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { HttpError, sendError, sendJson } from './http.js'

export interface Mount {
  handle(request: IncomingMessage, response: ServerResponse, path: readonly string[], query: URLSearchParams): Promise<void>
  close(): void
}

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
    if (name === undefined) {
      if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'method_not_allowed', 'Only GET is allowed')
      sendJson(response, 200, { couchdb: 'Welcome', version: '3.4.0', vendor: { name: 'minderal' }, uuid: listener.uuid })
      return
    }
    const mount = listener.mounts.get(name)
    if (mount === undefined) throw new HttpError(404, 'not_found', 'Database does not exist.')
    await mount.handle(request, response, rest, url.searchParams)
  } catch (error) {
    sendError(response, error)
  }
}
