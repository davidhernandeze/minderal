import type { NodeSetup } from '../capabilities/CapabilitySet.js'
import { DEFAULT_PRESENCE, type PresenceTiming } from '../cluster/channel.js'
import { callCluster } from '../cluster/clusterClient.js'
import { newClusterDocument, newNode, type ClusterDocument, type NodeAnnouncement } from '../cluster/ClusterDocument.js'
import { readClusterDocument, validClusterDocument, writeClusterDocument } from '../cluster/clusterStorage.js'
import { startCore, type Core } from '../Core.js'
import { ClusterError, DatasetNotFoundError, NetworkError, StorageError } from '../errors.js'
import { loadPlatform } from '../platform/loadPlatform.js'
import type { Platform } from '../platform/Platform.js'
import { detectRuntime } from '../Runtime.js'
import type { Credentials } from '../storage/DatabaseLocation.js'
import type { DatabaseHandle } from '../storage/DatabasePool.js'
import { locateDataset, type StorageDescriptor } from '../storage/StorageDescriptor.js'
import { CORE_VERSION } from '../version.js'
import { Registry, type RegistryEntry } from './Registry.js'

export interface DatasetOptions {
  readonly home?: string
  readonly credentials?: Credentials
  /** This node's name in the cluster. Defaults to the host name on Node.js, browser and OS in a browser. */
  readonly name?: string
  /** Lease timing an orchestrator gives its members: heartbeat every 10 s, offline after 30 s silent. */
  readonly presence?: Partial<PresenceTiming>
}

/**
 * Where the dataset lives. `none` — Node.js orchestrators only — keeps no copy at all: the orchestrator
 * holds the cluster document, and serves its members' data by relaying requests to whichever member
 * holding it is online.
 */
export type StorageOptions =
  | { readonly engine: 'local' }
  | { readonly engine: 'couchdb'; readonly url: string }
  | { readonly engine: 'none' }

export interface CreateDatasetOptions extends DatasetOptions {
  readonly storage?: StorageOptions
}

export interface JoinDatasetOptions extends Omit<DatasetOptions, 'credentials'> {
  /**
   * `{ engine: 'local' }` (default) copies the dataset and keeps it in sync. `{ engine: 'none' }` is client
   * mode: no copy, every read and write goes to a node of the cluster holding the data.
   */
  readonly storage?: { readonly engine: 'local' } | { readonly engine: 'none' }
}

export async function createDataset(options: CreateDatasetOptions = {}): Promise<Core> {
  const platform = await loadPlatform(detectRuntime())
  const home = options.home ?? platform.defaultHome()
  const datasetId = crypto.randomUUID()
  const storage = describeStorage(options.storage, platform)
  const founder = newNode(crypto.randomUUID(), platform.role, await announce(platform, options.name, setupOf(storage)), new Date())
  const handle = await platform.databases.acquire(locateDataset(home, datasetId, storage, credentialsFor(options, platform)))
  try {
    const document = await writeClusterDocument(handle.database, datasetId, newClusterDocument(datasetId, founder))
    await register(platform, home, { datasetId, nodeId: founder.id, storage, bootstrap: [] })
    return await start(platform, handle, {
      datasetId,
      nodeId: founder.id,
      cluster: document,
      bootstrap: [],
      name: undefined,
      holdsData: storage.engine !== 'none',
      presence: presenceOf(options),
    })
  } catch (error) {
    await handle.release()
    throw error
  }
}

export async function openDataset(datasetId: string, options: DatasetOptions = {}): Promise<Core> {
  const platform = await loadPlatform(detectRuntime())
  const home = options.home ?? platform.defaultHome()
  const entry = await lookUp(platform, home, datasetId)
  if (entry === undefined) throw new DatasetNotFoundError(datasetId)
  const handle = await platform.databases.acquire(locateDataset(home, datasetId, entry.storage, credentialsFor(options, platform)))
  try {
    const cluster = await readClusterDocument(handle.database, datasetId)
    return await start(platform, handle, {
      datasetId,
      nodeId: entry.nodeId,
      cluster,
      bootstrap: entry.bootstrap,
      name: options.name,
      holdsData: entry.storage.engine !== 'none',
      presence: presenceOf(options),
    })
  } catch (error) {
    await handle.release()
    throw error
  }
}

/**
 * Joins the dataset served at `endpoint` as a new member: the orchestrator admits this node and gives it
 * its node id, the dataset is copied into this runtime's local storage, and the core keeps it in sync.
 * Joining a dataset this runtime already holds opens it instead.
 */
export async function joinDataset(endpoint: string, options: JoinDatasetOptions = {}): Promise<Core> {
  const url = new URL(endpoint)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError(`A dataset endpoint is an http or https URL, got ${endpoint}`)
  const base = url.href.replace(/\/+$/, '')
  const platform = await loadPlatform(detectRuntime())
  const home = options.home ?? platform.defaultHome()

  const status = await callCluster(base, 'status', undefined)
  const datasetId = stringField(status.value, 'dataset', base, 'status')
  if ((await lookUp(platform, home, datasetId)) !== undefined) return openDataset(datasetId, options)
  const orchestratorHoldsData = !(typeof status.value === 'object' && status.value !== null && 'holdsData' in status.value && status.value.holdsData === false)

  const storage: StorageDescriptor =
    options.storage?.engine === 'none' ? { engine: 'none', clusterStore: platform.localEngine } : { engine: platform.localEngine }
  const holdsData = storage.engine !== 'none'
  const admission = await callCluster(base, 'join', { node: await announce(platform, options.name, setupOf(storage)) })
  const nodeId = stringField(admission.value, 'nodeId', base, 'join')
  const admittedCluster = admitted(admission.value, datasetId, base)
  const handle = await platform.databases.acquire(locateDataset(home, datasetId, storage, undefined))
  try {
    // the orchestrator's revision, history included, so this copy converges with every other
    await handle.database.bulkDocs([admittedCluster as unknown as PouchDB.Core.PutDocument<object>], { new_edits: false })
    if (holdsData) {
      try {
        await copyFrom(platform, handle, base, nodeId)
      } catch (error) {
        // an orchestrator without data has nothing to copy while no member holding it is online:
        // this node starts with the cluster document and catches up once one is
        if (orchestratorHoldsData) throw error
      }
    }
    const cluster = await readClusterDocument(handle.database, datasetId)
    await register(platform, home, { datasetId, nodeId, storage, bootstrap: [base] })
    return await start(platform, handle, {
      datasetId,
      nodeId,
      cluster,
      bootstrap: [base],
      name: undefined,
      holdsData,
      presence: presenceOf(options),
    })
  } catch (error) {
    await handle.release()
    throw error
  }
}

async function start(
  platform: Platform,
  handle: DatabaseHandle,
  context: {
    datasetId: string
    nodeId: string
    cluster: ClusterDocument
    bootstrap: readonly string[]
    name: string | undefined
    holdsData: boolean
    presence: PresenceTiming
  },
): Promise<Core> {
  const core = platform.createCore({ platform, database: handle, ...context })
  try {
    await core[startCore]()
  } catch (error) {
    await core.close().catch(() => undefined)
    throw error
  }
  return core
}

function setupOf(storage: StorageDescriptor): NodeSetup {
  return { holdsData: storage.engine !== 'none' }
}

function presenceOf(options: DatasetOptions): PresenceTiming {
  const timing = { ...DEFAULT_PRESENCE, ...options.presence }
  if (!(timing.heartbeatMs > 0) || !(timing.leaseMs > timing.heartbeatMs)) {
    throw new TypeError('Presence needs a positive heartbeat and a lease longer than it')
  }
  return timing
}

async function announce(platform: Platform, name: string | undefined, setup: NodeSetup): Promise<NodeAnnouncement> {
  const description = platform.describeNode()
  const chosen = name?.trim()
  return {
    name: chosen === undefined || chosen === '' ? description.defaultName : chosen,
    runtime: platform.runtime,
    coreVersion: CORE_VERSION,
    capabilities: await platform.capabilities.availableIds(setup),
    ...(description.userAgent === undefined ? {} : { userAgent: description.userAgent }),
    ...(description.os === undefined ? {} : { os: description.os }),
  }
}

async function copyFrom(platform: Platform, handle: DatabaseHandle, endpoint: string, nodeId: string): Promise<void> {
  const remote = platform.openRemote(endpoint, nodeId)
  try {
    await handle.database.replicate.from(remote)
  } catch (cause) {
    throw new NetworkError(endpoint, cause)
  } finally {
    await remote.close()
  }
}

function admitted(value: unknown, datasetId: string, endpoint: string): ClusterDocument {
  const cluster = typeof value === 'object' && value !== null && 'cluster' in value ? value.cluster : undefined
  try {
    return validClusterDocument(cluster, datasetId)
  } catch (cause) {
    throw new ClusterError(endpoint, 'admitted this node without a valid cluster document', cause)
  }
}

function stringField(value: unknown, field: string, endpoint: string, path: string): string {
  const found = typeof value === 'object' && value !== null && field in value ? (value as Record<string, unknown>)[field] : undefined
  if (typeof found !== 'string') throw new ClusterError(endpoint, `answered ${path} without ${field}`)
  return found
}

function describeStorage(storage: StorageOptions | undefined, platform: Platform): StorageDescriptor {
  if (storage === undefined || storage.engine === 'local') return { engine: platform.localEngine }
  if (storage.engine === 'none') {
    if (platform.role !== 'orchestrator') throw new TypeError('Only an orchestrator can run without a copy of its dataset')
    return { engine: 'none', clusterStore: platform.localEngine }
  }
  return { engine: 'couchdb', url: new URL(storage.url).href }
}

function credentialsFor(options: DatasetOptions, platform: Platform): Credentials | undefined {
  return options.credentials ?? platform.defaultCredentials()
}

async function register(platform: Platform, home: string, entry: RegistryEntry): Promise<void> {
  const registry = await Registry.open(platform, home)
  try {
    await attempt(entry.datasetId, 'register the dataset on this runtime', async () => registry.add(entry))
  } finally {
    await registry.close()
  }
}

async function lookUp(platform: Platform, home: string, datasetId: string): Promise<RegistryEntry | undefined> {
  const registry = await Registry.open(platform, home)
  try {
    return await attempt(datasetId, 'read the dataset registry', async () => registry.find(datasetId))
  } finally {
    await registry.close()
  }
}

async function attempt<Result>(datasetId: string, action: string, operation: () => Promise<Result>): Promise<Result> {
  try {
    return await operation()
  } catch (cause) {
    throw new StorageError(datasetId, action, cause)
  }
}
