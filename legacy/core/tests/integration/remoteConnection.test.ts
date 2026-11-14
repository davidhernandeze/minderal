import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ConnectionError, ConnectionFactory } from '../../src/index.js'

// These run against the real CouchDB from compose.yaml (npm run couchdb:up).
// Their job is to check the assumptions the unit tests can only assert about a
// stub: the cookie name, the /_session payload shape, and the status codes a
// real server returns. If CouchDB changes any of those, this is what breaks.
const couchUrl = process.env.COUCHDB_URL ?? 'http://localhost:5984'
const username = process.env.COUCHDB_USER ?? 'admin'
const password = process.env.COUCHDB_PASSWORD ?? 'password'

const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const testDatabaseNames = ['zeta-integration', 'alpha-integration']

async function adminRequest(path: string, method: string): Promise<Response> {
  return fetch(`${couchUrl}${path}`, { method, headers: { Authorization: basicAuth } })
}

beforeAll(async () => {
  try {
    const reachable = await fetch(`${couchUrl}/_up`)
    if (!reachable.ok) throw new Error(`responded ${reachable.status}`)
  } catch (cause) {
    throw new Error(
      `CouchDB is not reachable at ${couchUrl}. Run: npm run couchdb:up (${String(cause)})`
    )
  }
  for (const name of testDatabaseNames) {
    await adminRequest(`/${name}`, 'PUT')
  }
})

afterAll(async () => {
  for (const name of testDatabaseNames) {
    await adminRequest(`/${name}`, 'DELETE')
  }
})

describe('RemoteConnection against a real CouchDB', () => {
  it('logs in and keeps a session that later requests can use', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })

    // Proves the AuthSession cookie we parsed is genuinely accepted: _all_dbs
    // is admin-only, so an unauthenticated request would come back 401.
    await expect(connection.getDatabaseList()).resolves.toContain('alpha-integration')
  })

  it('lists the databases sorted and without CouchDB internals', async () => {
    const connection = await ConnectionFactory.createRemoteConnection({
      url: couchUrl,
      username,
      password
    })

    const names = await connection.getDatabaseList()

    expect(names).toEqual([...names].sort())
    expect(names).toContain('alpha-integration')
    expect(names).toContain('zeta-integration')
    expect(names.some((name) => name.startsWith('_'))).toBe(false)
  })

  it('rejects a wrong password', async () => {
    await expect(
      ConnectionFactory.createRemoteConnection({ url: couchUrl, username, password: 'wrong' })
    ).rejects.toThrow(ConnectionError)
  })

  it('rejects an unreachable host', async () => {
    await expect(
      ConnectionFactory.createRemoteConnection({ url: 'http://127.0.0.1:1' })
    ).rejects.toThrow()
  })

  it('connects anonymously but cannot list databases', async () => {
    // CouchDB answers GET /_session for anonymous callers, so creating the
    // connection succeeds; authorization only shows up on the first real call.
    const connection = await ConnectionFactory.createRemoteConnection({ url: couchUrl })

    await expect(connection.getDatabaseList()).rejects.toThrow(/failed with status 401/)
  })
})
