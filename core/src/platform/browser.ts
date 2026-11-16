import HttpAdapter from 'pouchdb-adapter-http'
import IndexedDbAdapter from 'pouchdb-adapter-indexeddb'
import PouchDB from 'pouchdb-core'
import { BrowserCore } from '../BrowserCore.js'
import { openCouchDb } from '../storage/couchdb.js'
import type { DatabaseLocation } from '../storage/DatabaseLocation.js'
import { DatabasePool } from '../storage/DatabasePool.js'
import type { Platform } from './Platform.js'

const BrowserPouchDB = PouchDB.plugin(HttpAdapter).plugin(IndexedDbAdapter)

function openDatabase(location: DatabaseLocation): PouchDB.Database {
  switch (location.engine) {
    case 'indexeddb':
      return new BrowserPouchDB(location.name, { adapter: 'indexeddb' })
    case 'couchdb':
      return openCouchDb(BrowserPouchDB, location.url, location.credentials)
    case 'leveldb':
      throw new Error('LevelDB storage is not available in a browser')
  }
}

export const browserPlatform: Platform = {
  runtime: 'browser',
  localEngine: 'indexeddb',
  role: 'member',
  databases: new DatabasePool(openDatabase),
  defaultHome: () => 'minderal',
  defaultCredentials: () => undefined,
  createCore: (context) => BrowserCore.create(context),
}
