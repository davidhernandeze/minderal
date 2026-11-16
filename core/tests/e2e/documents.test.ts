import { CoreClosedError, DocumentConflictError } from '@minderal/core'
import { describe, expect, it } from 'vitest'
import { createTracked } from '../support/datasets.js'

describe('core.documents (provisional raw access)', () => {
  it('writes, reads, lists and removes documents', async () => {
    const core = await createTracked()
    const { rev } = await core.documents.put({ _id: 'note:1', title: 'First' })
    await core.documents.put({ _id: 'note:2', title: 'Second' })

    expect(await core.documents.get('note:1')).toEqual({ _id: 'note:1', _rev: rev, title: 'First' })
    expect((await core.documents.list()).map((document) => document._id)).toEqual(['note:1', 'note:2'])

    await core.documents.remove('note:1', rev)
    expect(await core.documents.get('note:1')).toBeUndefined()
  })

  it('never lists or exposes the cluster document', async () => {
    const core = await createTracked()
    expect(await core.documents.list()).toEqual([])
    await expect(core.documents.get('_design/cluster')).rejects.toThrow(TypeError)
    await expect(core.documents.put({ _id: '_design/cluster' })).rejects.toThrow(TypeError)
  })

  it('throws DocumentConflictError when writing over a stale revision', async () => {
    const core = await createTracked()
    const { rev } = await core.documents.put({ _id: 'note:1', title: 'First' })
    await core.documents.put({ _id: 'note:1', _rev: rev, title: 'Edited' })
    await expect(core.documents.put({ _id: 'note:1', _rev: rev, title: 'Stale' })).rejects.toThrow(DocumentConflictError)
  })

  it('tells watchers about changes', async () => {
    const core = await createTracked()
    const seen: string[] = []
    const stop = core.documents.watch((change) => seen.push(change.id))
    await core.documents.put({ _id: 'note:1' })
    await expect.poll(() => seen).toEqual(['note:1'])
    stop()
  })

  it('refuses access once the core is closed', async () => {
    const core = await createTracked()
    await core.close()
    await expect(core.documents.list()).rejects.toThrow(CoreClosedError)
  })
})
