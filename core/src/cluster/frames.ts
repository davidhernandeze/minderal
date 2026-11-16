import { CapabilityUnavailableError, CoreError, NetworkError } from '../errors.js'
import { fromBase64, toBase64 } from '../util/bytes.js'

/**
 * The delegation wire protocol: a delegated result is a stream of newline-delimited JSON frames.
 *
 *   {"t":"head","v":...}      the result's JSON part — the request succeeded
 *   {"t":"chunk","b":"..."}   base64 bytes of the result's body, zero or more
 *   {"t":"end"}               the result is complete
 *   {"t":"error","e":{...}}   the capability failed; before a head it is the outcome, after one the result is partial
 *
 * A stream that stops without "end" or "error" was cut: the node went away.
 */
export type Frame =
  | { readonly t: 'head'; readonly v: unknown }
  | { readonly t: 'chunk'; readonly b: string }
  | { readonly t: 'end' }
  | { readonly t: 'error'; readonly e: SerializedError }

export interface SerializedError {
  readonly name: string
  readonly message: string
  readonly url?: string
}

export function encodeFrame(frame: Frame): string {
  return `${JSON.stringify(frame)}\n`
}

export function chunkFrame(bytes: Uint8Array): Frame {
  return { t: 'chunk', b: toBase64(bytes) }
}

export function chunkBytes(frame: Extract<Frame, { t: 'chunk' }>): Uint8Array {
  return fromBase64(frame.b)
}

export async function* decodeFrames(source: AsyncIterable<Uint8Array>): AsyncGenerator<Frame> {
  const decoder = new TextDecoder()
  let buffered = ''
  for await (const bytes of source) {
    buffered += decoder.decode(bytes, { stream: true })
    let newline = buffered.indexOf('\n')
    while (newline !== -1) {
      const line = buffered.slice(0, newline)
      buffered = buffered.slice(newline + 1)
      if (line.trim() !== '') yield parseFrame(line)
      newline = buffered.indexOf('\n')
    }
  }
  if (buffered.trim() !== '') throw new SyntaxError('Delegation stream ended inside a frame')
}

function parseFrame(line: string): Frame {
  const value: unknown = JSON.parse(line)
  if (typeof value !== 'object' || value === null || !('t' in value)) throw new SyntaxError('Malformed delegation frame')
  const frame = value as Record<string, unknown>
  switch (frame.t) {
    case 'head':
      return { t: 'head', v: frame.v }
    case 'chunk':
      if (typeof frame.b !== 'string') throw new SyntaxError('Malformed chunk frame')
      return { t: 'chunk', b: frame.b }
    case 'end':
      return { t: 'end' }
    case 'error': {
      const error = frame.e as Record<string, unknown> | undefined
      if (typeof error?.name !== 'string' || typeof error.message !== 'string') throw new SyntaxError('Malformed error frame')
      return { t: 'error', e: { name: error.name, message: error.message, ...(typeof error.url === 'string' ? { url: error.url } : {}) } }
    }
    default:
      throw new SyntaxError(`Unknown delegation frame ${String(frame.t)}`)
  }
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof NetworkError) return { name: error.name, message: error.message, url: error.url }
  if (error instanceof Error) return { name: error.name, message: error.message }
  return { name: 'Error', message: String(error) }
}

/**
 * Errors a capability's contract allows come back as themselves; anything else stays visible as a
 * remote failure without pretending to be a local error type.
 */
export function deserializeError(error: SerializedError): Error {
  switch (error.name) {
    case 'TypeError':
      return new TypeError(error.message)
    case 'NetworkError':
      return new NetworkError(error.url ?? 'unknown URL', new Error(error.message))
    default: {
      const remote = new CoreError(error.message)
      remote.name = error.name
      return remote
    }
  }
}

export function isUnavailable(error: SerializedError): boolean {
  return error.name === CapabilityUnavailableError.name
}
