import { mkdirSync } from 'node:fs'
import { arch, homedir, hostname, release, type } from 'node:os'
import { dirname, join } from 'node:path'
import HttpAdapter from 'pouchdb-adapter-http'
import LevelDbAdapter from 'pouchdb-adapter-leveldb'
import { CapabilitySet, type NodeSetup } from '../capabilities/CapabilitySet.js'
import { databaseCapability } from '../capabilities/database/contract.js'
import { answerDatabase } from '../Core.js'
import { fetchCapability } from '../capabilities/fetch/contract.js'
import { fetchFromNodejs } from '../capabilities/fetch/nodejs.js'
import { serveCapability } from '../capabilities/serve/contract.js'
import { ServerCore } from '../ServerCore.js'
import { openCouchDb, openEndpoint } from '../storage/couchdb.js'
import type { Credentials, DatabaseLocation } from '../storage/DatabaseLocation.js'
import { DatabasePool } from '../storage/DatabasePool.js'
import { withReplication } from '../storage/replication.js'
import type { Platform } from './Platform.js'

const NodejsPouchDB = withReplication().plugin(HttpAdapter).plugin(LevelDbAdapter)

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

const capabilities = new CapabilitySet<ServerCore>()
  .with(databaseCapability, async (core, request) => core[answerDatabase](request), holdsData)
  .with(fetchCapability, async (_core, url, options) => fetchFromNodejs(url, options))
  .with(serveCapability, async (core, options) => core.startServing(options))

async function holdsData(setup: NodeSetup): Promise<boolean> {
  return setup.holdsData
}

export const nodejsPlatform: Platform = {
  runtime: 'nodejs',
  localEngine: 'leveldb',
  role: 'orchestrator',
  databases: new DatabasePool(openDatabase),
  capabilities,
  openRemote: (url, nodeId) => openEndpoint(NodejsPouchDB, url, nodeId),
  defaultHome: () => process.env.MINDERAL_HOME ?? join(homedir(), '.minderal'),
  defaultCredentials: credentialsFromEnvironment,
  describeNode: () => ({
    defaultName: hostname(),
    userAgent: `Node.js/${process.versions.node}`,
    os: `${type()} ${release()} (${arch()})`,
  }),
  createCore: (context) => ServerCore.create(context),
}
