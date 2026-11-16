import type { CouchRequest, CouchResponse } from '../../database/couchApi.js'
import { readAll } from '../../util/bytes.js'
import { defineCapability, type Implementation, type Wire } from '../Capability.js'

export type DatabaseArgs = readonly [request: CouchRequest]

export type DatabaseImplementation = Implementation<DatabaseArgs, CouchResponse>

const databaseWire: Wire<DatabaseArgs, CouchResponse> = {
  encodeArgs([request]) {
    return request
  },

  decodeArgs(payload) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new TypeError('A database request must be an object')
    const value = payload as Record<string, unknown>
    if (typeof value.method !== 'string') throw new TypeError('A database request needs a method')
    if (!Array.isArray(value.path) || !value.path.every((segment) => typeof segment === 'string')) {
      throw new TypeError('A database request path is a list of strings')
    }
    const query = value.query ?? {}
    if (typeof query !== 'object' || query === null || !Object.values(query).every((entry) => typeof entry === 'string')) {
      throw new TypeError('A database request query maps names to strings')
    }
    return [
      {
        method: value.method,
        path: value.path as string[],
        query: query as Record<string, string>,
        ...(value.body === undefined ? {} : { body: value.body }),
      },
    ]
  },

  encodeResult(response) {
    const head = {
      status: response.status,
      ...(response.json === undefined ? {} : { json: response.json }),
      ...(response.headers === undefined ? {} : { headers: response.headers }),
      binary: response.bytes !== undefined,
    }
    const bytes = response.bytes
    if (bytes === undefined) return { head }
    return {
      head,
      body: (async function* () {
        yield bytes
      })(),
    }
  },

  async decodeResult(head, body) {
    if (typeof head !== 'object' || head === null) throw new TypeError('A database response head must be an object')
    const value = head as Record<string, unknown>
    if (typeof value.status !== 'number') throw new TypeError('A database response needs a status')
    const bytes = await readAll(body)
    return {
      status: value.status,
      ...(value.json === undefined ? {} : { json: value.json }),
      ...(typeof value.headers === 'object' && value.headers !== null ? { headers: value.headers as Record<string, string> } : {}),
      ...(value.binary === true ? { bytes } : {}),
    }
  },
}

/**
 * Answers a CouchDB API request from the node's own copy of the dataset. Every node holding the data
 * announces it, so an orchestrator without data can serve replication by asking one of them.
 */
export const databaseCapability = defineCapability<DatabaseArgs, CouchResponse>({
  name: 'database',
  version: 1,
  contract: {
    args: ['request: { method: string, path: string[], query: Record<string, string>, body?: JSON } — a CouchDB replication API request'],
    result: '{ status: number, json?: JSON, bytes?: bytes, headers?: Record<string, string> } — the CouchDB response, errors included',
  },
  wire: databaseWire,
})
