import type { AnyCapability } from '../capabilities/Capability.js'
import { chunkFrame, serializeError, type Frame } from './frames.js'

/**
 * Runs a capability for another node and yields its result as delegation frames: head, chunks, end —
 * or error. Stopping the iteration early stops reading the result, which cancels whatever produces it.
 * Shared by the HTTP endpoint (Node.js) and the relay channel (any runtime).
 */
export async function* produceFrames(
  capability: AnyCapability,
  payload: unknown,
  run: (args: readonly unknown[]) => Promise<unknown>,
): AsyncGenerator<Frame> {
  const wire = capability.wire
  let encoded: { head: unknown; body?: AsyncIterable<Uint8Array> }
  try {
    if (wire === undefined) throw new TypeError(`${capability.id} cannot be performed for another node`)
    encoded = wire.encodeResult(await run(wire.decodeArgs(payload)))
  } catch (error) {
    yield { t: 'error', e: serializeError(error) }
    return
  }
  yield { t: 'head', v: encoded.head }
  try {
    if (encoded.body !== undefined) {
      for await (const bytes of encoded.body) yield chunkFrame(bytes)
    }
  } catch (error) {
    yield { t: 'error', e: serializeError(error) }
    return
  }
  yield { t: 'end' }
}
