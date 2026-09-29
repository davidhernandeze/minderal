import { Connection } from './Connection.js'
import { ConnectionError } from './ConnectionError.js'
import { Database } from './Database.js'

type SessionFetch = (url: string | Request, options?: RequestInit) => Promise<Response>

export interface RemoteConnectionOptions {
  url: string
  username?: string
  password?: string
}

export const ANONYMOUS_REMOTE_USER = 'anonymous'

export class RemoteConnection extends Connection {
  private readonly baseUrl: string
  private readonly sessionUser: string
  // Not readonly: CouchDB answers every authenticated request with a
  // replacement cookie carrying a fresh timestamp, and a session lives
  // `couch_httpd_auth.timeout` from the newest one it has issued. Replaying the
  // cookie from login forever caps the connection at that timeout however busy
  // it is. A browser's cookie jar does this on its own; in Node nothing does.
  private sessionCookie: string | null

  private constructor(baseUrl: string, sessionCookie: string | null, sessionUser: string) {
    super()
    this.baseUrl = baseUrl
    this.sessionCookie = sessionCookie
    this.sessionUser = sessionUser
  }

  static async create(options: RemoteConnectionOptions): Promise<RemoteConnection> {
    const baseUrl = normalizeBaseUrl(options.url)
    const loginCookie = await openSession(baseUrl, options.username, options.password)
    const verified = await verifySession(baseUrl, loginCookie, options.username)
    // The verify response already carries a replacement; start from that rather
    // than from the login cookie, so no renewal is dropped on the way in.
    return new RemoteConnection(
      baseUrl,
      verified.sessionCookie ?? loginCookie,
      verified.user ?? ANONYMOUS_REMOTE_USER
    )
  }

  override get user(): string {
    return this.sessionUser
  }

  protected override createDatabase(name: string): Database {
    return Database.open(`${this.baseUrl}/${name}`, this.sessionUser, {
      fetch: this.createSessionFetch()
    })
  }

  async getDatabaseList(): Promise<string[]> {
    const response = await this.request(`${this.baseUrl}/_all_dbs`)
    if (!response.ok) {
      throw new ConnectionError(
        `Listing databases at ${this.baseUrl} failed with status ${response.status}`
      )
    }
    const payload: unknown = await response.json()
    if (!isStringArray(payload)) {
      throw new ConnectionError(`Unexpected _all_dbs payload from ${this.baseUrl}`)
    }
    return payload.filter((name) => !name.startsWith('_')).sort()
  }

  private async request(url: string): Promise<Response> {
    const response = await sendRequest(url, this.sessionCookie)
    this.absorbSessionCookie(response)
    return response
  }

  // Used by PouchDB for documents, the changes feed and replication, so the
  // renewal has to be picked up here as well as on our own requests.
  private createSessionFetch(): SessionFetch {
    return async (url, options) => {
      const headers = new Headers(options?.headers)
      if (this.sessionCookie !== null) headers.set('Cookie', this.sessionCookie)
      const response = await fetch(url, { ...options, headers, credentials: 'include' })
      this.absorbSessionCookie(response)
      return response
    }
  }

  // In a browser getSetCookie() is always empty, so this is a no-op there and
  // the jar keeps doing the work.
  private absorbSessionCookie(response: Response): void {
    const renewed = readSessionCookie(response)
    if (renewed !== null) this.sessionCookie = renewed
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

function sendRequest(url: string, sessionCookie: string | null): Promise<Response> {
  return fetch(url, {
    credentials: 'include',
    headers: sessionCookie === null ? {} : { Cookie: sessionCookie }
  })
}

async function openSession(
  baseUrl: string,
  username: string | undefined,
  password: string | undefined
): Promise<string | null> {
  if (username === undefined || password === undefined) return null

  const response = await fetch(`${baseUrl}/_session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: username, password })
  })
  if (!response.ok) {
    throw new ConnectionError(`Login to ${baseUrl} failed with status ${response.status}`)
  }
  return readSessionCookie(response)
}

interface VerifiedSession {
  user: string | null
  sessionCookie: string | null
}

async function verifySession(
  baseUrl: string,
  sessionCookie: string | null,
  username: string | undefined
): Promise<VerifiedSession> {
  const response = await sendRequest(`${baseUrl}/_session`, sessionCookie)
  if (!response.ok) {
    throw new ConnectionError(
      `Session check at ${baseUrl} failed with status ${response.status}`
    )
  }
  const payload: unknown = await response.json()
  if (!isSessionPayload(payload)) {
    throw new ConnectionError(`Unexpected _session payload from ${baseUrl}`)
  }
  if (username !== undefined && payload.userCtx.name !== username) {
    throw new ConnectionError(`Server at ${baseUrl} did not keep the session for ${username}`)
  }
  return { user: payload.userCtx.name, sessionCookie: readSessionCookie(response) }
}

function readSessionCookie(response: Response): string | null {
  if (typeof response.headers.getSetCookie !== 'function') return null
  const cookies = response.headers.getSetCookie()
  const authCookie = cookies.find((cookie) => cookie.startsWith('AuthSession='))
  if (authCookie === undefined) return null
  const [nameAndValue] = authCookie.split(';')
  return nameAndValue ?? null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isSessionPayload(value: unknown): value is { userCtx: { name: string | null } } {
  if (typeof value !== 'object' || value === null || !('userCtx' in value)) return false
  const { userCtx } = value
  if (typeof userCtx !== 'object' || userCtx === null || !('name' in userCtx)) return false
  return typeof userCtx.name === 'string' || userCtx.name === null
}
