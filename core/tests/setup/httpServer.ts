import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const server = createServer((request, response) => {
    void respond(request, response)
  })
  const baseUrl = `http://127.0.0.1:${await listen(server)}`
  project.provide('httpServerUrl', baseUrl)
  project.provide('closedServerUrl', await urlOfClosedPort())
  const homeRoot = await mkdtemp(join(tmpdir(), 'minderal-core-tests-'))
  project.provide('homeRoot', homeRoot)
  return async () => {
    await close(server)
    await rm(homeRoot, { recursive: true, force: true })
  }
}

async function respond(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readBody(request)
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  if (path === '/hello') {
    response.writeHead(200, { 'content-type': 'text/plain', 'x-served-by': 'test-server' })
    response.end('hello')
    return
  }
  if (path === '/stream') {
    // numbered lines, one every `interval` ms: lets a test cut a forwarded body midway
    const query = new URL(request.url ?? '/', 'http://localhost').searchParams
    const chunks = Number(query.get('chunks') ?? '5')
    const interval = Number(query.get('interval') ?? '20')
    response.writeHead(200, { 'content-type': 'text/plain' })
    for (let index = 0; index < chunks && !response.destroyed; index += 1) {
      response.write(`chunk-${index}\n`)
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
    response.end()
    return
  }
  if (path === '/echo') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(
      JSON.stringify({
        method: request.method,
        header: request.headers['x-minderal-test'] ?? null,
        contentType: request.headers['content-type'] ?? null,
        bodyBase64: body.toString('base64'),
      }),
    )
    return
  }
  response.writeHead(404, { 'content-type': 'text/plain' })
  response.end('not found')
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Uint8Array[] = []
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk))
  }
  const body = new Uint8Array(chunks.reduce((length, chunk) => length + chunk.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  return Buffer.from(body)
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('test server has no port')
  return (address satisfies AddressInfo).port
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)))
  })
}

async function urlOfClosedPort(): Promise<string> {
  const probe = createServer()
  const port = await listen(probe)
  await close(probe)
  return `http://127.0.0.1:${port}/hello`
}
