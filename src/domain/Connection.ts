import { Database } from '@/domain/Database'
import { ConnectionConfig } from '@/domain/types/config'
import { v4 as generateId } from 'uuid'
import { EventEmitter } from 'events'

export interface DbSecurityGroup {
  names: string[]
  roles: string[]
}

export interface DbSecurity {
  admins?: DbSecurityGroup
  members?: DbSecurityGroup
}

export interface CouchDbUser {
  name: string
  roles: string[]
  type: string
}

export class Connection extends EventEmitter {
  id: string = ''
  name: string = ''
  url: string = ''
  is_online: boolean = false
  is_remote: boolean = false
  dbs: Map<string, Database> = new Map()
  config: ConnectionConfig

  constructor(config: ConnectionConfig) {
    super()
    this.id = config.id || generateId()
    this.name = config.name
    this.url = config.url || ''
    this.is_remote = config.is_remote || false
    this.config = config

    for (const databaseConfig of config.dbs || []) {
      this.addDatabase(databaseConfig.name)
    }
  }

  static async createRemote(config: ConnectionConfig): Promise<Connection | null> {
    const connection = new Connection(config)
    if (config.auth?.password) {
      await connection.login(config.url, config.auth.username, config.auth.password)
    }
    delete connection.config.auth?.password
    await connection.updateDatabaseList()
    return connection
  }

  public addDatabase(name: string) {
    if (this.dbs.has(name)) return

    const database = new Database(name, this)
    void database.startListening()
    this.dbs.set(name, database)

    database.on('change', () => {
      this.emit('change', this)
    })
  }

  async login(url: string, username: string, password: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: username, password })
      })

      if (!response.ok) {
        return true
      }

      const data = await response.json()
      if (!data.ok) {
        return true
      }

      // Extract AuthSession cookie from Set-Cookie header (if accessible)
      // In browser context, cookies are handled automatically with credentials: 'include'
      this.config.session_cookie = response.headers.get('set-cookie') || ''
      return true
    } catch {
      return false
    }
  }

  async testDbAccess(dbName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.url}/${encodeURIComponent(dbName)}`, {
        credentials: 'include'
      })
      return response.ok
    } catch {
      return false
    }
  }

  async fetchRemoteDatabases(): Promise<string[]> {
    if (!this.url) return []

    try {
      const response = await fetch(`${this.url}/_all_dbs`, {
        credentials: 'include'
      })
      if (!response.ok) return []
      const dbs: string[] = await response.json()
      // Filter out internal CouchDB databases
      const candidates = dbs.filter((db) => !db.startsWith('_'))

      // Test access to each database in parallel, keep only accessible ones
      const results = await Promise.all(
        candidates.map(async (db) => ({ name: db, accessible: await this.testDbAccess(db) }))
      )
      return results.filter((r) => r.accessible).map((r) => r.name)
    } catch {
      return []
    }
  }

  async updateDatabaseList(): Promise<void> {
    const dbNames = await this.fetchRemoteDatabases()

    // Remove databases the user no longer has access to
    for (const name of Array.from(this.dbs.keys())) {
      if (!dbNames.includes(name)) {
        const db = this.dbs.get(name)
        if (db) await db.closeClient()
        this.dbs.delete(name)
      }
    }

    // Add any new accessible databases
    for (const dbName of dbNames) {
      this.addDatabase(dbName)
    }

    this.setOnline(true)
  }

  setOnline(online: boolean) {
    this.is_online = online
    this.emit('change', this)
  }

  async createRemoteDatabase(dbName: string): Promise<boolean> {
    if (!this.url) return false
    try {
      const response = await fetch(`${this.url}/${encodeURIComponent(dbName)}`, {
        method: 'PUT',
        credentials: 'include'
      })
      if (!response.ok) return false
      this.addDatabase(dbName)
      return true
    } catch {
      return false
    }
  }

  async getDbSecurity(dbName: string): Promise<DbSecurity | null> {
    if (!this.url) return null
    try {
      const response = await fetch(`${this.url}/${encodeURIComponent(dbName)}/_security`, {
        credentials: 'include'
      })
      if (!response.ok) return null
      return await response.json()
    } catch {
      return null
    }
  }

  async setDbSecurity(dbName: string, security: DbSecurity): Promise<boolean> {
    if (!this.url) return false
    try {
      const response = await fetch(`${this.url}/${encodeURIComponent(dbName)}/_security`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(security)
      })
      return response.ok
    } catch {
      return false
    }
  }

  async getUsers(): Promise<CouchDbUser[]> {
    if (!this.url) return []
    try {
      const response = await fetch(
        `${this.url}/_users/_all_docs?include_docs=true&startkey="org.couchdb.user:"&endkey="org.couchdb.user:\ufff0"`,
        { credentials: 'include' }
      )
      if (!response.ok) return []
      const data = await response.json()
      return data.rows.map((row: { doc: { name: string; roles: string[]; type: string } }) => ({
        name: row.doc.name,
        roles: row.doc.roles || [],
        type: row.doc.type
      }))
    } catch {
      return []
    }
  }

  async createUser(username: string, password: string, roles: string[] = []): Promise<boolean> {
    if (!this.url) return false
    try {
      const response = await fetch(
        `${this.url}/_users/org.couchdb.user:${encodeURIComponent(username)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: username,
            password,
            roles,
            type: 'user'
          })
        }
      )
      return response.ok
    } catch {
      return false
    }
  }

  async deleteUser(username: string): Promise<boolean> {
    if (!this.url) return false
    try {
      // First get the user doc to obtain _rev
      const getResponse = await fetch(
        `${this.url}/_users/org.couchdb.user:${encodeURIComponent(username)}`,
        { credentials: 'include' }
      )
      if (!getResponse.ok) return false
      const userDoc = await getResponse.json()

      const response = await fetch(
        `${this.url}/_users/org.couchdb.user:${encodeURIComponent(username)}?rev=${userDoc._rev}`,
        {
          method: 'DELETE',
          credentials: 'include'
        }
      )
      return response.ok
    } catch {
      return false
    }
  }

  async addUserToDb(dbName: string, username: string): Promise<boolean> {
    const security = await this.getDbSecurity(dbName)
    if (!security) return false
    if (!security.members) security.members = { names: [], roles: [] }
    if (!security.members.names?.includes(username)) {
      if (!security.members.names) security.members.names = []
      security.members.names.push(username)
    }
    return await this.setDbSecurity(dbName, security)
  }

  async removeUserFromDb(dbName: string, username: string): Promise<boolean> {
    const security = await this.getDbSecurity(dbName)
    if (!security?.members?.names) return false
    security.members.names = security.members.names.filter((n: string) => n !== username)
    return await this.setDbSecurity(dbName, security)
  }

  getConfig(): ConnectionConfig {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      auth: this.config.auth,
      is_remote: this.config.is_remote,
      is_online: this.config.is_online,
      session_cookie: this.config.session_cookie,
      dbs: this.getDatabaseList().map((db) => db.getConfig())
    }
  }

  getDatabaseList(): Database[] {
    return Array.from(this.dbs.values())
  }

  getDatabase(name: string): Database | null {
    return this.dbs.get(name) || null
  }
}
