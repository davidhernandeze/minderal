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
  private readonly sessionCookie: string | null
  private readonly sessionUser: string

  private constructor(baseUrl: string, sessionCookie: string | null, sessionUser: string) {
    super()
    this.baseUrl = baseUrl
    this.sessionCookie = sessionCookie
    this.sessionUser = sessionUser
  }

  static async create(options: RemoteConnectionOptions): Promise<RemoteConnection> {
    const baseUrl = normalizeBaseUrl(options.url)
    const sessionCookie = await openSession(baseUrl, options.username, options.password)
    const sessionUser = await verifySession(baseUrl, sessionCookie, options.username)
    return new RemoteConnection(baseUrl, sessionCookie, sessionUser ?? ANONYMOUS_REMOTE_USER)
  }

  override getDatabase(name: string): Database {
    return Database.create(`${this.baseUrl}/${name}`, this.sessionUser, {
      fetch: createSessionFetch(this.sessionCookie)
    })
  }

  async getDatabaseList(): Promise<string[]> {
    const response = await sendRequest(`${this.baseUrl}/_all_dbs`, this.sessionCookie)
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

function createSessionFetch(sessionCookie: string | null): SessionFetch {
  return (url, options) => {
    const headers = new Headers(options?.headers)
    if (sessionCookie !== null) headers.set('Cookie', sessionCookie)
    return fetch(url, { ...options, headers, credentials: 'include' })
  }
}

async function verifySession(
  baseUrl: string,
  sessionCookie: string | null,
  username: string | undefined
): Promise<string | null> {
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
  return payload.userCtx.name
}

function readSessionCookie(response: Response): string | null {
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
