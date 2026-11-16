import { fromBase64, readStream, toBase64, toStream } from '../../util/bytes.js'
import { defineCapability, type Implementation, type Wire } from '../Capability.js'

export interface FetchOptions {
  readonly method?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string | Uint8Array<ArrayBuffer>
}

export type FetchArgs = readonly [url: string, options: FetchOptions]

export type FetchImplementation = Implementation<FetchArgs, Response>

const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304])

const fetchWire: Wire<FetchArgs, Response> = {
  encodeArgs([url, options]) {
    return {
      url,
      ...(options.method === undefined ? {} : { method: options.method }),
      ...(options.headers === undefined ? {} : { headers: options.headers }),
      ...(options.body === undefined
        ? {}
        : typeof options.body === 'string'
          ? { body: { text: options.body } }
          : { body: { base64: toBase64(options.body) } }),
    }
  },

  decodeArgs(payload) {
    const value = record(payload, 'fetch arguments')
    if (typeof value.url !== 'string') throw new TypeError('fetch needs a url')
    const url = parseHttpUrl(value.url).href
    const options: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array<ArrayBuffer> } = {}
    if (value.method !== undefined) {
      if (typeof value.method !== 'string') throw new TypeError('fetch method must be a string')
      options.method = value.method
    }
    if (value.headers !== undefined) {
      const headers = record(value.headers, 'fetch headers')
      if (!Object.values(headers).every((header) => typeof header === 'string')) {
        throw new TypeError('fetch headers must be strings')
      }
      options.headers = headers as Record<string, string>
    }
    if (value.body !== undefined) {
      const body = record(value.body, 'fetch body')
      if (typeof body.text === 'string') options.body = body.text
      else if (typeof body.base64 === 'string') options.body = fromBase64(body.base64)
      else throw new TypeError('fetch body must be text or base64')
    }
    return [url, options]
  },

  encodeResult(response) {
    const head = { status: response.status, statusText: response.statusText, headers: [...response.headers] }
    return response.body === null ? { head } : { head, body: readStream(response.body) }
  },

  async decodeResult(head, body) {
    const value = record(head, 'fetch response')
    if (typeof value.status !== 'number' || typeof value.statusText !== 'string' || !Array.isArray(value.headers)) {
      throw new TypeError('fetch response head is malformed')
    }
    const init = { status: value.status, statusText: value.statusText, headers: value.headers as [string, string][] }
    if (NULL_BODY_STATUSES.has(value.status)) {
      for await (const _ of body) {
        // a null-body status carries no bytes; draining surfaces a cut-off stream as an error here
      }
      return new Response(null, init)
    }
    return new Response(toStream(body), init)
  },
}

export const fetchCapability = defineCapability<FetchArgs, Response>({
  name: 'fetch',
  version: 1,
  contract: {
    args: ['url: an absolute http or https URL', 'options: { method?: string, headers?: Record<string, string>, body?: string | bytes }'],
    result:
      'a Response with any HTTP status; its body streams and errors with PartialResultError when a forwarded body is cut short',
  },
  wire: fetchWire,
})

export function parseHttpUrl(url: string): URL {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`fetch supports http and https URLs only, got ${parsed.protocol}`)
  }
  return parsed
}

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${what} must be an object`)
  return value as Record<string, unknown>
}
