import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Connection, ConnectionError, ConnectionFactory } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

// Every local test uses the memory adapter so nothing touches disk. The all-dbs
// registry is shared by every PouchDB constructor in the process and strips
// adapter prefixes, so local databases are effectively device-global: two
// LocalConnections list the same names whatever adapter they were given. That
// is why each test has to tear down the databases it created.
// Handles are kept rather than reopened by name: opening a second handle would
// re-register the name in the all-dbs registry and conflict with the destroy.
const openDatabases: PouchDB.Database[] = []

async function createLocalDatabase(name: string): Promise<PouchDB.Database> {
  const database = new PouchDB(name, { adapter: 'memory' })
  await database.info()
  openDatabases.push(database)
  return database
}

async function destroyLocalDatabase(database: PouchDB.Database): Promise<void> {
  openDatabases.splice(openDatabases.indexOf(database), 1)
  await database.destroy()
}

afterEach(async () => {
  for (const database of [...openDatabases]) {
    await destroyLocalDatabase(database)
  }
})

describe('ConnectionFactory.createLocalConnection', () => {
  it('returns a connection without needing to be awaited', () => {
    const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })

    expect(connection).toBeInstanceOf(Connection)
  })

  it('lists local databases sorted by name', async () => {
    const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
    await createLocalDatabase('notes')
    await createLocalDatabase('archive')

    await expect(connection.getDatabaseList()).resolves.toEqual(['archive', 'notes'])
  })

  it('drops a database from the list once it is destroyed', async () => {
    const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
    const scratch = await createLocalDatabase('scratch')
    expect(await connection.getDatabaseList()).toContain('scratch')

    await destroyLocalDatabase(scratch)

    expect(await connection.getDatabaseList()).not.toContain('scratch')
  })

  it('reports an empty list when no local database exists', async () => {
    const connection = ConnectionFactory.createLocalConnection({ adapter: 'memory' })

    await expect(connection.getDatabaseList()).resolves.toEqual([])
  })
})

// The remote side is pure CouchDB HTTP, so fetch is stubbed per test with a
// route table. Anything not in the table is a test-authoring mistake, not a 404.
type RouteHandler = (request: RequestInit | undefined) => Response

function stubCouchServer(routes: Record<string, RouteHandler>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string | URL, request?: RequestInit) => {
    const method = request?.method ?? 'GET'
    const key = `${method} ${String(url)}`
    const handler = routes[key]
    if (handler === undefined) throw new Error(`unstubbed request: ${key}`)
    return Promise.resolve(handler(request))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), init)
}

const loggedInSession = jsonResponse.bind(null, { ok: true, userCtx: { name: 'david' } })
const anonymousSession = jsonResponse.bind(null, { ok: true, userCtx: { name: null } })

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('ConnectionFactory.createRemoteConnection', () => {
  it('logs in, verifies the session, and carries the cookie forward', async () => {
    const fetchMock = stubCouchServer({
      'POST http://couch.test/_session': () =>
        new Response(JSON.stringify({ ok: true, name: 'david' }), {
          headers: { 'set-cookie': 'AuthSession=abc123; Version=1; Path=/; HttpOnly' }
        }),
      'GET http://couch.test/_session': loggedInSession,
      'GET http://couch.test/_all_dbs': () => jsonResponse(['notes'])
    })

    const connection = await ConnectionFactory.createRemoteConnection({
      url: 'http://couch.test',
      username: 'david',
      password: 'secret'
    })
    await connection.getDatabaseList()

    // The login body is what CouchDB expects, and every later request replays
    // the AuthSession cookie without its attributes.
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'david', password: 'secret' })
    })
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: { Cookie: 'AuthSession=abc123' }
    })
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: { Cookie: 'AuthSession=abc123' }
    })
  })

  it('skips the login request when no credentials are given', async () => {
    const fetchMock = stubCouchServer({
      'GET http://couch.test/_session': anonymousSession
    })

    await ConnectionFactory.createRemoteConnection({ url: 'http://couch.test' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://couch.test/_session')
  })

  it('trims trailing slashes off the url', async () => {
    const fetchMock = stubCouchServer({
      'GET http://couch.test/_session': anonymousSession
    })

    await ConnectionFactory.createRemoteConnection({ url: 'http://couch.test//' })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://couch.test/_session')
  })

  it('throws when the credentials are rejected', async () => {
    stubCouchServer({
      'POST http://couch.test/_session': () => jsonResponse({ error: 'unauthorized' }, { status: 401 })
    })

    await expect(
      ConnectionFactory.createRemoteConnection({
        url: 'http://couch.test',
        username: 'david',
        password: 'wrong'
      })
    ).rejects.toThrow(ConnectionError)
  })

  it('throws when the server does not keep the session it just granted', async () => {
    // Login succeeds but the follow-up shows an anonymous user: the cookie did
    // not stick, so the connection is not usable and must not be handed back.
    stubCouchServer({
      'POST http://couch.test/_session': () => jsonResponse({ ok: true }),
      'GET http://couch.test/_session': anonymousSession
    })

    await expect(
      ConnectionFactory.createRemoteConnection({
        url: 'http://couch.test',
        username: 'david',
        password: 'secret'
      })
    ).rejects.toThrow(/did not keep the session/)
  })

  it('throws when the session check itself fails', async () => {
    stubCouchServer({
      'GET http://couch.test/_session': () => new Response('down', { status: 503 })
    })

    await expect(
      ConnectionFactory.createRemoteConnection({ url: 'http://couch.test' })
    ).rejects.toThrow(/failed with status 503/)
  })
})

describe('Session renewal', () => {
  function couchCookie(value: string): ResponseInit {
    return { headers: { 'set-cookie': `AuthSession=${value}; Version=1; Path=/; HttpOnly` } }
  }

  it('replays the newest cookie the server issued, not the one from login', async () => {
    // CouchDB re-issues the cookie on every authenticated response and dates
    // the session from the newest one. Replaying the login cookie forever caps
    // the connection at couch_httpd_auth.timeout however busy it is.
    const fetchMock = stubCouchServer({
      'POST http://couch.test/_session': () => new Response('{"ok":true}', couchCookie('one')),
      'GET http://couch.test/_session': () =>
        new Response(JSON.stringify({ ok: true, userCtx: { name: 'david' } }), couchCookie('two')),
      'GET http://couch.test/_all_dbs': () => new Response('["notes"]', couchCookie('three'))
    })

    const connection = await ConnectionFactory.createRemoteConnection({
      url: 'http://couch.test',
      username: 'david',
      password: 'secret'
    })
    await connection.getDatabaseList()
    await connection.getDatabaseList()

    const sent = fetchMock.mock.calls.map((call) => {
      const headers = call[1]?.headers
      return headers !== undefined && 'Cookie' in headers ? headers.Cookie : null
    })
    // login (none) -> verify uses the login cookie -> then each renewal in turn.
    expect(sent).toEqual([null, 'AuthSession=one', 'AuthSession=two', 'AuthSession=three'])
  })

  it('keeps the current cookie when a response carries no replacement', async () => {
    const fetchMock = stubCouchServer({
      'POST http://couch.test/_session': () => new Response('{"ok":true}', couchCookie('one')),
      'GET http://couch.test/_session': () =>
        jsonResponse({ ok: true, userCtx: { name: 'david' } }),
      'GET http://couch.test/_all_dbs': () => jsonResponse(['notes'])
    })

    const connection = await ConnectionFactory.createRemoteConnection({
      url: 'http://couch.test',
      username: 'david',
      password: 'secret'
    })
    await connection.getDatabaseList()

    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({
      headers: { Cookie: 'AuthSession=one' }
    })
  })
})

describe('RemoteConnection.getDatabaseList', () => {
  async function connectTo(routes: Record<string, RouteHandler>): Promise<Connection> {
    stubCouchServer({ 'GET http://couch.test/_session': anonymousSession, ...routes })
    return ConnectionFactory.createRemoteConnection({ url: 'http://couch.test' })
  }

  it('hides CouchDB internal databases and sorts the rest', async () => {
    const connection = await connectTo({
      'GET http://couch.test/_all_dbs': () =>
        jsonResponse(['notes', '_users', 'archive', '_replicator'])
    })

    await expect(connection.getDatabaseList()).resolves.toEqual(['archive', 'notes'])
  })

  it('throws when the server refuses the listing', async () => {
    const connection = await connectTo({
      'GET http://couch.test/_all_dbs': () => new Response('nope', { status: 403 })
    })

    await expect(connection.getDatabaseList()).rejects.toThrow(/failed with status 403/)
  })

  it('throws when the payload is not a list of names', async () => {
    const connection = await connectTo({
      'GET http://couch.test/_all_dbs': () => jsonResponse({ error: 'not_found' })
    })

    await expect(connection.getDatabaseList()).rejects.toThrow(/Unexpected _all_dbs payload/)
  })
})
