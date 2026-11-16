import type { Credentials, DatabaseLocation } from './DatabaseLocation.js'

export type LocalEngine = 'leveldb' | 'indexeddb'

export type StorageDescriptor =
  | { readonly engine: LocalEngine }
  | { readonly engine: 'couchdb'; readonly url: string }

export function locateDataset(
  home: string,
  datasetId: string,
  storage: StorageDescriptor,
  credentials: Credentials | undefined,
): DatabaseLocation {
  switch (storage.engine) {
    case 'leveldb':
      return { engine: 'leveldb', path: `${home}/datasets/${datasetId}` }
    case 'indexeddb':
      return { engine: 'indexeddb', name: `${home}/datasets/${datasetId}` }
    case 'couchdb':
      return { engine: 'couchdb', url: `${storage.url.replace(/\/+$/, '')}/minderal-${datasetId}`, credentials }
  }
}

export function locateRegistry(home: string, engine: LocalEngine): DatabaseLocation {
  return engine === 'leveldb' ? { engine, path: `${home}/registry` } : { engine, name: `${home}/registry` }
}
