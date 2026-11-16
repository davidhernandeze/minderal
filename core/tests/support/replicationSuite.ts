import { afterEach, beforeEach, describe, expect, it } from 'vitest'

export interface ReplicationTarget {
  readonly url: string
  readonly credentials?: { readonly username: string; readonly password: string }
  dispose?(): Promise<void>
}

type Client = typeof import('./replicationClient.js')

export function describeReplicationTarget(name: string, createTarget: () => Promise<ReplicationTarget>): void {
  describe(`replication against ${name}`, () => {
    let client: Client
    let target: ReplicationTarget
    let remote: PouchDB.Database
    const locals: PouchDB.Database[] = []

    function local(): PouchDB.Database {
      const database = client.memoryDatabase()
      locals.push(database)
      return database
    }

    beforeEach(async () => {
      client = await import('./replicationClient.js')
      target = await createTarget()
      remote = client.remoteDatabase(target.url, target.credentials)
    })

    afterEach(async () => {
      await Promise.all(locals.splice(0).map(async (database) => database.destroy()))
      await remote.close()
      await target.dispose?.()
    })

    it('carries documents pushed by one client to another', async () => {
      const writer = local()
      await writer.bulkDocs([{ _id: 'a', value: 1 }, { _id: 'b', value: 2 }])
      await writer.replicate.to(remote)

      const reader = local()
      await reader.replicate.from(remote)
      expect(await reader.get('a')).toMatchObject({ value: 1 })
      expect(await reader.get('b')).toMatchObject({ value: 2 })
    })

    it('resumes from its checkpoint instead of resending everything', async () => {
      const writer = local()
      await writer.bulkDocs([{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }])
      expect((await writer.replicate.to(remote)).docs_written).toBe(3)
      await writer.put({ _id: 'd' })
      expect((await writer.replicate.to(remote)).docs_written).toBe(1)

      const reader = local()
      expect((await reader.replicate.from(remote)).docs_read).toBeGreaterThanOrEqual(4)
      expect((await reader.replicate.from(remote)).docs_read).toBe(0)
    })

    it('replicates more documents than one batch holds', async () => {
      const writer = local()
      await writer.bulkDocs(Array.from({ length: 250 }, (_, index) => ({ _id: `doc-${String(index).padStart(3, '0')}` })))
      await writer.replicate.to(remote, { batch_size: 50 })

      const reader = local()
      await reader.replicate.from(remote, { batch_size: 50 })
      const ids = (await reader.allDocs()).rows.map((row) => row.id).filter((id) => id.startsWith('doc-'))
      expect(ids).toHaveLength(250)
    })

    it('propagates deletions', async () => {
      const writer = local()
      const { rev } = await writer.put({ _id: 'gone' })
      await writer.replicate.to(remote)
      const reader = local()
      await reader.replicate.from(remote)

      await writer.remove('gone', rev)
      await writer.replicate.to(remote)
      await reader.replicate.from(remote)
      await expect(reader.get('gone')).rejects.toMatchObject({ status: 404 })
    })

    it('keeps both sides of a conflict', async () => {
      const first = local()
      await first.put({ _id: 'shared', value: 'original' })
      await first.replicate.to(remote)
      const second = local()
      await second.replicate.from(remote)

      const original = await first.get('shared')
      await first.put({ ...original, value: 'first' })
      await second.put({ ...original, value: 'second' })
      await first.replicate.to(remote)
      await second.replicate.to(remote)

      const observer = local()
      await observer.replicate.from(remote)
      const winner = await observer.get('shared', { conflicts: true })
      expect(winner._conflicts).toHaveLength(1)
      const losing = await observer.get('shared', { rev: winner._conflicts?.[0] ?? '' })
      const values = [winner, losing].map((doc) => ('value' in doc ? doc.value : undefined))
      expect(values.sort()).toEqual(['first', 'second'])
    })

    it('carries binary attachments', async () => {
      const bytes = [0, 1, 2, 127, 128, 254, 255]
      const writer = local()
      await writer.put({
        _id: 'with-file',
        _attachments: {
          'file.bin': { content_type: 'application/octet-stream', data: btoa(String.fromCharCode(...bytes)) },
        },
      })
      await writer.replicate.to(remote)

      const reader = local()
      await reader.replicate.from(remote)
      const attachment = await reader.getAttachment('with-file', 'file.bin')
      expect(attachment instanceof Uint8Array ? [...attachment] : undefined).toEqual(bytes)
    })

    it('delivers changes to a live replication as they happen', async () => {
      const reader = local()
      const live = reader.replicate.from(remote, { live: true, retry: false })
      try {
        await new Promise<void>((resolve, reject) => {
          live.on('paused', () => resolve())
          live.on('error', reject)
        })
        const arrived = new Promise<void>((resolve) => {
          const feed = reader.changes({ since: 'now', live: true }).on('change', (change) => {
            if (change.id !== 'late') return
            feed.cancel()
            resolve()
          })
        })

        const writer = local()
        await writer.put({ _id: 'late' })
        await writer.replicate.to(remote)
        await arrived
        expect(await reader.get('late')).toMatchObject({ _id: 'late' })
      } finally {
        live.cancel()
      }
    })
  })
}
