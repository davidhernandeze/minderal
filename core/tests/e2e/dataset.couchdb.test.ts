import { openDataset, StorageError } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, freshHome, track } from '../support/datasets.js'

const runtime = inject('runtime')

function couchdb(): { url: string; credentials: { username: string; password: string } } {
  const provided = inject('couchdb')
  if (provided === undefined) throw new Error('CouchDB suite ran without MINDERAL_TEST_COUCHDB_URL')
  return provided
}

async function readFromCouchDb(path: string): Promise<Response> {
  const { url, credentials } = couchdb()
  return fetch(new URL(path, url), {
    headers: { authorization: `Basic ${btoa(`${credentials.username}:${credentials.password}`)}` },
  })
}

describe('a dataset stored in CouchDB', () => {
  it('writes the cluster document into its CouchDB database', async () => {
    const { url, credentials } = couchdb()
    const core = await createTracked({ storage: { engine: 'couchdb', url }, credentials })

    const response = await readFromCouchDb(`/minderal-${core.datasetId}/_design/cluster`)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      dataset: core.datasetId,
      nodes: [{ id: core.nodeId, runtime, role: runtime === 'nodejs' ? 'orchestrator' : 'member', coreVersion: expect.any(String) }],
    })
  })

  it('reopens from the registry', async () => {
    const { url, credentials } = couchdb()
    const home = freshHome()
    const created = await createTracked({ home, storage: { engine: 'couchdb', url }, credentials })
    await created.close()

    const reopened = track(await openDataset(created.datasetId, { home, credentials }))
    expect(reopened.nodeId).toBe(created.nodeId)
    expect(reopened.cluster.nodes).toEqual(created.cluster.nodes)
  })

  it('throws StorageError when the credentials are rejected', async () => {
    const { url, credentials } = couchdb()
    const home = freshHome()
    const created = await createTracked({ home, storage: { engine: 'couchdb', url }, credentials })
    await created.close()

    // a user that does not exist: a wrong password for the real admin counts toward CouchDB's lockout
    const wrong = { username: `nobody-${crypto.randomUUID()}`, password: 'wrong' }
    await expect(openDataset(created.datasetId, { home, credentials: wrong })).rejects.toThrow(StorageError)
  })
})
