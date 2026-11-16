import {
  CORE_VERSION,
  CoreClosedError,
  createDataset,
  DatasetNotFoundError,
  openDataset,
  StorageError,
} from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked, freshHome, track } from '../support/datasets.js'

const runtime = inject('runtime')
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('createDataset()', () => {
  it('returns an open core for the runtime it is running on', async () => {
    const core = await createTracked()
    expect(core.runtime).toBe(runtime)
    expect(core.datasetId).toMatch(uuid)
    expect(core.nodeId).toMatch(uuid)
    expect(core.isClosed).toBe(false)
  })

  it('creates a cluster with the core as its only node, describing itself', async () => {
    const core = await createTracked({ name: 'Kitchen laptop' })
    expect(core.cluster.nodes).toEqual([
      {
        id: core.nodeId,
        name: 'Kitchen laptop',
        runtime,
        role: runtime === 'nodejs' ? 'orchestrator' : 'member',
        coreVersion: CORE_VERSION,
        capabilities: runtime === 'nodejs' ? ['fetch@1', 'serve@1'] : [],
        userAgent: expect.any(String),
        os: expect.any(String),
        joinedAt: expect.any(String),
        announcedAt: expect.any(String),
      },
    ])
    expect(core.cluster.self?.id).toBe(core.nodeId)
    expect(core.role).toBe(runtime === 'nodejs' ? 'orchestrator' : 'member')
  })

  it('names the node after where it runs unless told otherwise', async () => {
    const core = await createTracked()
    expect(core.cluster.self?.name).toEqual(expect.any(String))
    expect(core.cluster.self?.name.length).toBeGreaterThan(0)
  })

  it('creates a new dataset on every call', async () => {
    const home = freshHome()
    const cores = await Promise.all([1, 2, 3].map(async () => track(await createDataset({ home }))))
    expect(new Set(cores.map((core) => core.datasetId)).size).toBe(3)
  })

  it('throws StorageError when CouchDB cannot be reached, and registers nothing', async () => {
    const home = freshHome()
    const unreachable = new URL(inject('closedServerUrl')).origin
    const failure = createDataset({ home, storage: { engine: 'couchdb', url: unreachable } })
    await expect(failure).rejects.toThrow(StorageError)
  })
})

describe('openDataset()', () => {
  it('reopens a closed dataset with the same identity and cluster', async () => {
    const home = freshHome()
    const created = await createDataset({ home })
    const { datasetId, nodeId, cluster } = created
    const nodes = cluster.nodes
    await created.close()

    const reopened = track(await openDataset(datasetId, { home }))
    expect(reopened.datasetId).toBe(datasetId)
    expect(reopened.nodeId).toBe(nodeId)
    expect(reopened.cluster.nodes).toEqual(nodes)
  })

  it('opens every dataset created in parallel', async () => {
    const home = freshHome()
    const created = await Promise.all([1, 2, 3].map(async () => createDataset({ home })))
    await Promise.all(created.map(async (core) => core.close()))
    for (const { datasetId } of created) {
      expect(track(await openDataset(datasetId, { home })).datasetId).toBe(datasetId)
    }
  })

  it('records a new name given when reopening', async () => {
    const home = freshHome()
    const created = await createDataset({ home, name: 'Before' })
    await created.close()
    const reopened = track(await openDataset(created.datasetId, { home, name: 'After' }))
    expect(reopened.cluster.self?.name).toBe('After')
  })

  it('lets several cores hold the same dataset, independently of each other', async () => {
    const home = freshHome()
    const first = await createDataset({ home })
    const second = track(await openDataset(first.datasetId, { home }))
    await first.close()

    const third = track(await openDataset(first.datasetId, { home }))
    expect(third.cluster.nodes).toEqual(second.cluster.nodes)
  })

  it('throws DatasetNotFoundError for a dataset this runtime does not know', async () => {
    const missing = crypto.randomUUID()
    const failure = openDataset(missing, { home: freshHome() })
    await expect(failure).rejects.toThrow(DatasetNotFoundError)
    await expect(failure).rejects.toMatchObject({ datasetId: missing })
  })

  it('keeps registries apart per home', async () => {
    const core = await createTracked()
    await expect(openDataset(core.datasetId, { home: freshHome() })).rejects.toThrow(DatasetNotFoundError)
  })
})

describe('core.close()', () => {
  it('closes the core, and closing again does nothing', async () => {
    const core = await createTracked()
    await core.close()
    await core.close()
    expect(core.isClosed).toBe(true)
  })

  it('makes every capability throw CoreClosedError', async () => {
    const core = await createTracked()
    await core.close()
    await expect(core.fetch(inject('httpServerUrl'))).rejects.toThrow(CoreClosedError)
  })
})
