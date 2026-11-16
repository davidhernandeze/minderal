import { DatasetEndpoint, type EndpointHost } from './DatasetEndpoint.js'
import { HttpListenerPool, type ListenerHandle } from './HttpListenerPool.js'
import type { ServeOptions } from '../capabilities/serve/contract.js'

const listeners = new HttpListenerPool()
const WILDCARD_HOSTS = new Set(['0.0.0.0', '::', '[::]'])

export interface ServedDataset {
  readonly url: string
  stop(): Promise<void>
}

export async function serveDataset(
  database: PouchDB.Database,
  datasetId: string,
  options: ServeOptions,
  endpointHost: EndpointHost,
): Promise<ServedDataset> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 0
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new TypeError(`Invalid port ${port}`)
  if (WILDCARD_HOSTS.has(host) && options.publicUrl === undefined) {
    throw new TypeError(`Serving on all interfaces (${host}) needs a publicUrl to advertise to other nodes`)
  }
  for (const origin of options.origins ?? []) {
    if (origin !== '*' && new URL(origin).origin !== origin) throw new TypeError(`${origin} is not an origin, like http://localhost:5173`)
  }
  const publicBase = options.publicUrl === undefined ? undefined : new URL(options.publicUrl)
  const name = `minderal-${datasetId}`
  const listener: ListenerHandle = await listeners.acquire(host, port)
  try {
    listener.mount(name, new DatasetEndpoint(database, datasetId, name, endpointHost))
  } catch (error) {
    await listener.release()
    throw error
  }
  const base = publicBase?.href.replace(/\/+$/, '') ?? `http://${host.includes(':') ? `[${host}]` : host}:${listener.port}`
  return {
    url: `${base}/${name}`,
    stop: async () => {
      listener.unmount(name)
      await listener.release()
    },
  }
}
