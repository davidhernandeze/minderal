const CHUNK = 0x8000

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK))
  }
  return btoa(binary)
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

/** Reads a stream chunk by chunk, without relying on ReadableStream being async iterable everywhere. */
export async function* readStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  let finished = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        finished = true
        return
      }
      yield value
    }
  } finally {
    // stopped early: cancel, so whatever feeds the stream (a socket, an upstream request) stops too
    if (!finished) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** The opposite of readStream: a pull-based stream over an async iterable, which cancels it when the reader does. */
export function toStream(
  source: AsyncIterable<Uint8Array>,
  onError: (error: unknown) => void = () => undefined,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  const iterator = source[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next()
        if (done) controller.close()
        else controller.enqueue(new Uint8Array(value))
      } catch (error) {
        onError(error)
        controller.error(error)
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })
}

export async function readAll(source: AsyncIterable<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const chunk of source) {
    chunks.push(chunk)
    length += chunk.length
  }
  const all = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    all.set(chunk, offset)
    offset += chunk.length
  }
  return all
}
