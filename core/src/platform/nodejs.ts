import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import HttpAdapter from 'pouchdb-adapter-http'
import LevelDbAdapter from 'pouchdb-adapter-leveldb'
import PouchDB from 'pouchdb-core'
import { ServerCore } from '../ServerCore.js'
import { openCouchDb } from '../storage/couchdb.js'
import type { Credentials, DatabaseLocation } from '../storage/DatabaseLocation.js'
import { DatabasePool } from '../storage/DatabasePool.js'
import type { Platform } from './Platform.js'

const NodejsPouchDB = PouchDB.plugin(HttpAdapter).plugin(LevelDbAdapter)

function openDatabase(location: DatabaseLocation): PouchDB.Database {
  switch (location.engine) {
    case 'leveldb':
      mkdirSync(dirname(location.path), { recursive: true })
      return new NodejsPouchDB(location.path, { adapter: 'leveldb' })
    case 'couchdb':
      return openCouchDb(NodejsPouchDB, location.url, location.credentials)
    case 'indexeddb':
      throw new Error('IndexedDB storage is not available on Node.js')
  }
}

function credentialsFromEnvironment(): Credentials | undefined {
  const username = process.env.MINDERAL_COUCHDB_USERNAME
  const password = process.env.MINDERAL_COUCHDB_PASSWORD
  if (username === undefined || password === undefined) return undefined
  return { username, password }
}

export const nodejsPlatform: Platform = {
  runtime: 'nodejs',
  localEngine: 'leveldb',
  role: 'orchestrator',
  databases: new DatabasePool(openDatabase),
  defaultHome: () => process.env.MINDERAL_HOME ?? join(homedir(), '.minderal'),
  defaultCredentials: credentialsFromEnvironment,
  createCore: (context) => ServerCore.create(context),
}
