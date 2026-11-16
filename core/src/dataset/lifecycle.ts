import { Cluster } from '../cluster/Cluster.js'
import { isClusterDocument, newClusterDocument, CLUSTER_DOCUMENT_ID, type ClusterDocument } from '../cluster/ClusterDocument.js'
import type { Core } from '../Core.js'
import { DatasetNotFoundError, StorageError } from '../errors.js'
import { loadPlatform } from '../platform/loadPlatform.js'
import type { Platform } from '../platform/Platform.js'
import { detectRuntime } from '../Runtime.js'
import type { Credentials } from '../storage/DatabaseLocation.js'
import type { DatabaseHandle } from '../storage/DatabasePool.js'
import { locateDataset, type StorageDescriptor } from '../storage/StorageDescriptor.js'
import { Registry, type RegistryEntry } from './Registry.js'

export interface DatasetOptions {
  readonly home?: string
  readonly credentials?: Credentials
}

export type StorageOptions = { readonly engine: 'local' } | { readonly engine: 'couchdb'; readonly url: string }

export interface CreateDatasetOptions extends DatasetOptions {
  readonly storage?: StorageOptions
}

export async function createDataset(options: CreateDatasetOptions = {}): Promise<Core> {
  const platform = await loadPlatform(detectRuntime())
  const home = options.home ?? platform.defaultHome()
  const datasetId = crypto.randomUUID()
  const node = { id: crypto.randomUUID(), runtime: platform.runtime, role: platform.role }
  const storage = describeStorage(options.storage, platform)
  const handle = await platform.databases.acquire(locateDataset(home, datasetId, storage, credentialsFor(options, platform)))
  try {
    const document = newClusterDocument(datasetId, node)
    await attempt(datasetId, 'write the cluster document', async () => handle.database.put({ ...document }))
    await register(platform, home, { datasetId, nodeId: node.id, storage, bootstrap: [] })
    return platform.createCore({ datasetId, nodeId: node.id, database: handle, cluster: Cluster.fromDocument(document) })
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
    const document = await readClusterDocument(handle, datasetId)
    return platform.createCore({ datasetId, nodeId: entry.nodeId, database: handle, cluster: Cluster.fromDocument(document) })
  } catch (error) {
    await handle.release()
    throw error
  }
}

function describeStorage(storage: StorageOptions | undefined, platform: Platform): StorageDescriptor {
  if (storage === undefined || storage.engine === 'local') return { engine: platform.localEngine }
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

async function readClusterDocument(handle: DatabaseHandle, datasetId: string): Promise<ClusterDocument> {
  const document: unknown = await attempt(datasetId, 'read the cluster document', async () =>
    handle.database.get(CLUSTER_DOCUMENT_ID),
  )
  if (!isClusterDocument(document) || document.dataset !== datasetId) {
    throw new StorageError(datasetId, 'read a valid cluster document', document)
  }
  return document
}

async function attempt<Result>(datasetId: string, action: string, operation: () => Promise<Result>): Promise<Result> {
  try {
    return await operation()
  } catch (cause) {
    throw new StorageError(datasetId, action, cause)
  }
}
