import { describe, expect, it } from 'vitest'
import { fetchCapability } from '../../src/capabilities/fetch/contract.js'
import { chunkBytes, chunkFrame, decodeFrames, deserializeError, encodeFrame, serializeError, type Frame } from '../../src/cluster/frames.js'
import { CoreError, NetworkError } from '../../src/errors.js'

async function* bytesOf(...parts: string[]): AsyncGenerator<Uint8Array> {
  for (const part of parts) yield new TextEncoder().encode(part)
}

async function collect(source: AsyncIterable<Frame>): Promise<Frame[]> {
  const frames: Frame[] = []
  for await (const frame of source) frames.push(frame)
  return frames
}

describe('delegation frames', () => {
  it('round-trips frames split anywhere across network chunks', async () => {
    const frames: Frame[] = [{ t: 'head', v: { status: 200 } }, chunkFrame(new Uint8Array([0, 255])), { t: 'end' }]
    const text = frames.map(encodeFrame).join('')
    const split = [text.slice(0, 5), text.slice(5, 23), text.slice(23)]
    expect(await collect(decodeFrames(bytesOf(...split)))).toEqual(frames)
  })

  it('carries bytes exactly', () => {
    const bytes = new Uint8Array(70_000).map((_, index) => index % 256)
    const frame = chunkFrame(bytes)
    expect(frame.t === 'chunk' && chunkBytes(frame)).toEqual(bytes)
  })

  it('fails on a stream cut inside a frame', async () => {
    await expect(collect(decodeFrames(bytesOf('{"t":"end"}\n{"t":"he')))).rejects.toThrow(SyntaxError)
  })

  it('brings contract errors back as themselves and others as named CoreErrors', () => {
    const network = deserializeError(serializeError(new NetworkError('http://x/', new Error('refused'))))
    expect(network).toBeInstanceOf(NetworkError)
    expect(network).toMatchObject({ url: 'http://x/' })
    expect(deserializeError(serializeError(new TypeError('bad')))).toBeInstanceOf(TypeError)
    const other = deserializeError({ name: 'RangeError', message: 'boom' })
    expect(other).toBeInstanceOf(CoreError)
    expect(other).toMatchObject({ name: 'RangeError', message: 'boom' })
  })
})

describe('fetch@1 wire format', () => {
  const wire = fetchCapability.wire!

  it('round-trips arguments, text and binary bodies alike', () => {
    const text = ['http://x/a', { method: 'POST', headers: { a: 'b' }, body: 'hi' }] as const
    const binary = ['http://x/a', { body: new Uint8Array([1, 2, 3]) }] as const
    expect(wire.decodeArgs(JSON.parse(JSON.stringify(wire.encodeArgs(text))))).toEqual(text)
    expect(wire.decodeArgs(JSON.parse(JSON.stringify(wire.encodeArgs(binary))))).toEqual(binary)
  })

  it.each([
    ['no url', {}],
    ['a file url', { url: 'file:///etc/hosts' }],
    ['non-string headers', { url: 'http://x/', headers: { a: 1 } }],
    ['an unknown body', { url: 'http://x/', body: { blob: 'x' } }],
  ])('rejects arguments with %s', (_, payload) => {
    expect(() => wire.decodeArgs(payload)).toThrow(TypeError)
  })

  it('rebuilds a response, including statuses that carry no body', async () => {
    const response = await wire.decodeResult({ status: 201, statusText: 'Created', headers: [['x-a', '1']] }, bytesOf('done'))
    expect(response.status).toBe(201)
    expect(response.headers.get('x-a')).toBe('1')
    expect(await response.text()).toBe('done')
    expect((await wire.decodeResult({ status: 204, statusText: '', headers: [] }, bytesOf())).body).toBeNull()
  })
})
