import { CoreClosedError, DocumentConflictError } from '@minderal/core'
import { describe, expect, it } from 'vitest'
import { createTracked } from '../support/datasets.js'

describe('core.dataset (provisional raw access)', () => {
  it('writes, reads, lists and removes documents', async () => {
    const core = await createTracked()
    const { rev } = await core.dataset.put({ _id: 'neuron:1', title: 'First' })
    await core.dataset.put({ _id: 'neuron:2', title: 'Second' })

    expect(await core.dataset.get('neuron:1')).toEqual({ _id: 'neuron:1', _rev: rev, title: 'First' })
    expect((await core.dataset.list()).map((document) => document._id)).toEqual(['neuron:1', 'neuron:2'])

    await core.dataset.remove('neuron:1', rev)
    expect(await core.dataset.get('neuron:1')).toBeUndefined()
  })

  it('never lists or exposes the cluster document', async () => {
    const core = await createTracked()
    expect(await core.dataset.list()).toEqual([])
    await expect(core.dataset.get('_design/cluster')).rejects.toThrow(TypeError)
    await expect(core.dataset.put({ _id: '_design/cluster' })).rejects.toThrow(TypeError)
  })

  it('throws DocumentConflictError when writing over a stale revision', async () => {
    const core = await createTracked()
    const { rev } = await core.dataset.put({ _id: 'neuron:1', title: 'First' })
    await core.dataset.put({ _id: 'neuron:1', _rev: rev, title: 'Edited' })
    await expect(core.dataset.put({ _id: 'neuron:1', _rev: rev, title: 'Stale' })).rejects.toThrow(DocumentConflictError)
  })

  it('tells watchers about changes', async () => {
    const core = await createTracked()
    const seen: string[] = []
    const stop = core.dataset.watch((change) => seen.push(change.id))
    await core.dataset.put({ _id: 'neuron:1' })
    await expect.poll(() => seen).toEqual(['neuron:1'])
    stop()
  })

  it('refuses access once the core is closed', async () => {
    const core = await createTracked()
    await core.close()
    await expect(core.dataset.list()).rejects.toThrow(CoreClosedError)
  })
})
