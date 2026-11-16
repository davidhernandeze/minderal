import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AnyCapability } from '../capabilities/Capability.js'
import { chunkFrame, encodeFrame, serializeError, type Frame } from '../cluster/frames.js'
import { readJson } from './http.js'

export interface Invocation {
  readonly capability: AnyCapability
  run(args: readonly unknown[]): Promise<unknown>
}

/**
 * Runs a capability on behalf of another node and streams the result back as delegation frames. Once the
 * 200 is sent every outcome is a frame: a head and chunks then end, or an error. If the requester goes away,
 * reading the result stops, which cancels whatever produces it.
 */
export async function serveInvocation(invocation: Invocation, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const payload = await readJson(request)
  response.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' })
  let gone = false
  response.on('close', () => {
    gone = !response.writableFinished
  })
  const send = async (frame: Frame): Promise<void> => {
    if (gone) return
    if (!response.write(encodeFrame(frame))) {
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
  }

  const wire = invocation.capability.wire
  try {
    if (wire === undefined) throw new TypeError(`${invocation.capability.id} cannot be performed for another node`)
    const args: unknown = typeof payload === 'object' && payload !== null && 'args' in payload ? payload.args : undefined
    const result = await invocation.run(wire.decodeArgs(args))
    const encoded = wire.encodeResult(result)
    await send({ t: 'head', v: encoded.head })
    if (encoded.body !== undefined) {
      for await (const bytes of encoded.body) {
        if (gone) break
        await send(chunkFrame(bytes))
      }
    }
    await send({ t: 'end' })
  } catch (error) {
    await send({ t: 'error', e: serializeError(error) })
  } finally {
    response.end()
  }
}
