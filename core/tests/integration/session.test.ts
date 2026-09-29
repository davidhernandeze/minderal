import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionFactory } from '../../src/index.js'

// CouchDB dates a session from the newest cookie it issued, and re-issues one
// on every authenticated response. This proves the connection follows those
// renewals: without it, a busy client still dies at couch_httpd_auth.timeout.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const TIMEOUT_PATH = '/_node/_local/_config/couch_httpd_auth/timeout'
const SHORT_TIMEOUT_SECONDS = 5

async function configRequest(method: string, body?: string): Promise<Response> {
  return fetch(`${couchUrl}${TIMEOUT_PATH}`, {
    method,
    headers: { Authorization: basicAuth, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body })
  })
}

let previousTimeout: string | null = null

beforeAll(async () => {
  const reachable = await fetch(`${couchUrl}/_up`).catch(() => null)
  if (reachable === null || !reachable.ok) {
    throw new Error(`CouchDB is not reachable at ${couchUrl}. Run: npm run couchdb:up`)
  }
  const current = await configRequest('GET')
  previousTimeout = current.ok ? ((await current.json()) as string) : null
  await configRequest('PUT', JSON.stringify(String(SHORT_TIMEOUT_SECONDS)))
})

// Always put the server back, even if an expectation fails.
afterAll(async () => {
  if (previousTimeout === null) await configRequest('DELETE')
  else await configRequest('PUT', JSON.stringify(previousTimeout))
})

describe('Session renewal against a real CouchDB', () => {
  it('outlives its own timeout while the connection stays busy', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })

    // Well past the 5s timeout, at a pace that keeps renewing.
    const deadline = Date.now() + SHORT_TIMEOUT_SECONDS * 2500
    let requests = 0
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await connection.getDatabaseList()
      requests += 1
    }

    expect(requests).toBeGreaterThan(SHORT_TIMEOUT_SECONDS)
    await connection.close()
  }, 30000)

  it('still expires when the connection goes quiet', async () => {
    // The window slides, it does not become unlimited.
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })
    await connection.getDatabaseList()

    await new Promise((resolve) => setTimeout(resolve, (SHORT_TIMEOUT_SECONDS + 3) * 1000))

    await expect(connection.getDatabaseList()).rejects.toThrow(/status 401/)
    await connection.close()
  }, 30000)
})
