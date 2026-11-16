import PouchDB from 'pouchdb-core'
import Replication from 'pouchdb-replication'

/**
 * pouchdb-core plugins patch the one shared PouchDB class, and the replication plugin cannot be applied
 * twice — any other module in the process (an app, a test client) may have applied it already.
 */
export function withReplication(): PouchDB.Static {
  if (!Object.prototype.hasOwnProperty.call(PouchDB.prototype, 'replicate')) PouchDB.plugin(Replication)
  return PouchDB
}
