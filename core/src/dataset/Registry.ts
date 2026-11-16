import type { Platform } from '../platform/Platform.js'
import type { DatabaseHandle } from '../storage/DatabasePool.js'
import { locateRegistry, type StorageDescriptor } from '../storage/StorageDescriptor.js'

export interface RegistryEntry {
  readonly datasetId: string
  readonly nodeId: string
  readonly storage: StorageDescriptor
  readonly bootstrap: readonly string[]
}

interface RegistryDocument {
  readonly _id: string
  readonly nodeId: string
  readonly storage: StorageDescriptor
  readonly bootstrap: readonly string[]
}

export class Registry {
  private readonly handle: DatabaseHandle

  private constructor(handle: DatabaseHandle) {
    this.handle = handle
  }

  static async open(platform: Platform, home: string): Promise<Registry> {
    return new Registry(await platform.databases.acquire(locateRegistry(home, platform.localEngine)))
  }

  async find(datasetId: string): Promise<RegistryEntry | undefined> {
    try {
      const document: unknown = await this.handle.database.get(datasetId)
      if (!isRegistryDocument(document)) return undefined
      return { datasetId: document._id, nodeId: document.nodeId, storage: document.storage, bootstrap: document.bootstrap }
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
  }

  async add(entry: RegistryEntry): Promise<void> {
    const document: RegistryDocument = {
      _id: entry.datasetId,
      nodeId: entry.nodeId,
      storage: entry.storage,
      bootstrap: entry.bootstrap,
    }
    await this.handle.database.put(document)
  }

  async close(): Promise<void> {
    await this.handle.release()
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}

function isRegistryDocument(value: unknown): value is RegistryDocument {
  if (typeof value !== 'object' || value === null) return false
  const candidate: { _id?: unknown; nodeId?: unknown; storage?: unknown; bootstrap?: unknown } = value
  return (
    typeof candidate._id === 'string' &&
    typeof candidate.nodeId === 'string' &&
    isStorageDescriptor(candidate.storage) &&
    Array.isArray(candidate.bootstrap) &&
    candidate.bootstrap.every((endpoint) => typeof endpoint === 'string')
  )
}

function isStorageDescriptor(value: unknown): value is StorageDescriptor {
  if (typeof value !== 'object' || value === null) return false
  const candidate: { engine?: unknown; url?: unknown } = value
  if (candidate.engine === 'leveldb' || candidate.engine === 'indexeddb') return true
  return candidate.engine === 'couchdb' && typeof candidate.url === 'string'
}
