import type { IncomingMessage, ServerResponse } from 'node:http'

const MAX_BODY_BYTES = 64 * 1024 * 1024

export class HttpError extends Error {
  readonly status: number
  readonly error: string

  constructor(status: number, error: string, reason: string) {
    super(reason)
    this.status = status
    this.error = error
  }
}

export async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const chunk of request) {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk)
    length += bytes.length
    if (length > MAX_BODY_BYTES) throw new HttpError(413, 'too_large', 'The request body is too large')
    chunks.push(bytes)
  }
  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  const text = new TextDecoder().decode(body)
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'bad_request', 'The request body is not valid JSON')
  }
}

export function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  if (response.headersSent) {
    response.end(payload)
    return
  }
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'must-revalidate' })
  response.end(payload)
}

export function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: error.error, reason: error.message })
    return
  }
  const status = statusOf(error)
  const name = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : 'unknown_error'
  const reason = error instanceof Error ? error.message : String(error)
  sendJson(response, status, { error: name, reason })
}

function statusOf(error: unknown): number {
  if (typeof error !== 'object' || error === null || !('status' in error)) return 500
  return typeof error.status === 'number' ? error.status : 500
}
