import { describe, inject } from 'vitest'
import { describeReplicationTarget } from '../support/replicationSuite.js'

describe.runIf(inject('runtime') === 'nodejs')('CouchDB, the reference implementation', () => {
  describeReplicationTarget('CouchDB', async () => {
    const couchdb = inject('couchdb')
    if (couchdb === undefined) throw new Error('CouchDB suite ran without MINDERAL_TEST_COUCHDB_URL')
    const url = new URL(`/parity-${crypto.randomUUID()}`, couchdb.url).href
    const authorization = `Basic ${btoa(`${couchdb.credentials.username}:${couchdb.credentials.password}`)}`
    const created = await fetch(url, { method: 'PUT', headers: { authorization } })
    if (!created.ok) throw new Error(`Could not create ${url}: ${created.status}`)
    return {
      url,
      credentials: couchdb.credentials,
      dispose: async () => {
        await fetch(url, { method: 'DELETE', headers: { authorization } })
      },
    }
  })
})
