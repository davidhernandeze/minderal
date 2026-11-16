import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AnyCapability } from '../capabilities/Capability.js'
import { encodeFrame, type Frame } from '../cluster/frames.js'
import { produceFrames } from '../cluster/produceFrames.js'
import { readJson } from './http.js'

export interface Invocation {
  readonly capability: AnyCapability
  run(args: readonly unknown[]): Promise<unknown>
}

/** Runs a capability for another node over HTTP, streaming the frames back. */
export async function serveInvocation(invocation: Invocation, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const payload = await readJson(request)
  const args: unknown = typeof payload === 'object' && payload !== null && 'args' in payload ? payload.args : undefined
  response.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' })
  await pipeFrames(produceFrames(invocation.capability, args, async (decoded) => invocation.run(decoded)), response)
}

/**
 * Writes frames to a response as NDJSON with backpressure, stopping when the client goes away. Bytes
 * already encoded elsewhere (`{ t: 'raw' }`) pass through as they are.
 */
export async function pipeFrames(lines: AsyncIterable<Frame | { t: 'raw'; raw: Uint8Array }>, response: ServerResponse): Promise<void> {
  let gone = false
  const onClose = (): void => {
    gone = !response.writableFinished
  }
  response.on('close', onClose)
  try {
    for await (const frame of lines) {
      if (gone) break
      const chunk = frame.t === 'raw' ? frame.raw : encodeFrame(frame)
      if (!response.write(chunk)) await drained(response)
    }
  } finally {
    response.off('close', onClose)
    response.end()
  }
}

async function drained(response: ServerResponse): Promise<void> {
  await new Promise<void>((resolve) => {
    const done = (): void => {
      response.off('drain', done)
      response.off('close', done)
      resolve()
    }
    response.on('drain', done)
    response.on('close', done)
  })
}
