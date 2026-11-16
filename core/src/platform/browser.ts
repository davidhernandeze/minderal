import HttpAdapter from 'pouchdb-adapter-http'
import IndexedDbAdapter from 'pouchdb-adapter-indexeddb'
import { BrowserCore } from '../BrowserCore.js'
import { CapabilitySet, type NodeSetup } from '../capabilities/CapabilitySet.js'
import { databaseCapability } from '../capabilities/database/contract.js'
import { answerDatabase } from '../Core.js'
import { openCouchDb, openEndpoint } from '../storage/couchdb.js'
import type { DatabaseLocation } from '../storage/DatabaseLocation.js'
import { DatabasePool } from '../storage/DatabasePool.js'
import { withReplication } from '../storage/replication.js'
import type { NodeDescription, Platform } from './Platform.js'

const BrowserPouchDB = withReplication().plugin(HttpAdapter).plugin(IndexedDbAdapter)

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

interface UserAgentData {
  readonly platform?: string
  readonly brands?: readonly { readonly brand: string }[]
}

function describeBrowser(): NodeDescription {
  const agent = navigator.userAgent
  const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData
  const os = (data?.platform !== undefined && data.platform !== '' ? data.platform : undefined) ?? osFromUserAgent(agent)
  const browser = browserFromBrands(data?.brands) ?? browserFromUserAgent(agent)
  return { defaultName: os === undefined ? browser : `${browser} on ${os}`, userAgent: agent, ...(os === undefined ? {} : { os }) }
}

function osFromUserAgent(agent: string): string | undefined {
  if (/Android/.test(agent)) return 'Android'
  if (/iPhone|iPad|iPod/.test(agent)) return 'iOS'
  if (/Mac OS X|Macintosh/.test(agent)) return 'macOS'
  if (/Windows/.test(agent)) return 'Windows'
  if (/CrOS/.test(agent)) return 'ChromeOS'
  if (/Linux/.test(agent)) return 'Linux'
  return undefined
}

function browserFromBrands(brands: readonly { readonly brand: string }[] | undefined): string | undefined {
  const names = (brands ?? []).map(({ brand }) => brand).filter((brand) => !/not.*brand/i.test(brand))
  return names.find((name) => name !== 'Chromium') ?? names[0]
}

function browserFromUserAgent(agent: string): string {
  if (/Edg\//.test(agent)) return 'Edge'
  if (/Firefox\//.test(agent)) return 'Firefox'
  if (/Chrome\//.test(agent)) return 'Chrome'
  if (/Safari\//.test(agent)) return 'Safari'
  return 'Browser'
}

async function holdsData(setup: NodeSetup): Promise<boolean> {
  return setup.holdsData
}

export const browserPlatform: Platform = {
  runtime: 'browser',
  localEngine: 'indexeddb',
  role: 'member',
  databases: new DatabasePool(openDatabase),
  capabilities: new CapabilitySet<BrowserCore>().with(
    databaseCapability,
    async (core, request) => core[answerDatabase](request),
    holdsData,
  ),
  openRemote: (url, nodeId) => openEndpoint(BrowserPouchDB, url, nodeId),
  defaultHome: () => 'minderal',
  defaultCredentials: () => undefined,
  describeNode: describeBrowser,
  createCore: (context) => BrowserCore.create(context),
}
