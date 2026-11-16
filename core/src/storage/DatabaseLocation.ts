export interface Credentials {
  readonly username: string
  readonly password: string
}

export type DatabaseLocation =
  | { readonly engine: 'leveldb'; readonly path: string }
  | { readonly engine: 'indexeddb'; readonly name: string }
  | { readonly engine: 'couchdb'; readonly url: string; readonly credentials: Credentials | undefined }

export function locationKey(location: DatabaseLocation): string {
  switch (location.engine) {
    case 'leveldb':
      return `leveldb:${location.path}`
    case 'indexeddb':
      return `indexeddb:${location.name}`
    case 'couchdb':
      return `couchdb:${location.credentials?.username ?? ''}@${location.url}`
  }
}
