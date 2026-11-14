import PouchDB from 'pouchdb'
import memoryAdapter from 'pouchdb-adapter-memory'
import { afterEach, describe, expect, it } from 'vitest'
import { ConnectionFactory, StringNeuron } from '../src/index.js'
import type { Database, Replication } from '../src/index.js'

PouchDB.plugin(memoryAdapter)

// Two independent connections stand in for two devices.
const deviceOne = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const deviceTwo = ConnectionFactory.createLocalConnection({ adapter: 'memory' })
const databaseNames: string[] = []
const started: Replication[] = []

function useDatabases(name: string): [Database, Database] {
  databaseNames.push(`${name}-a`, `${name}-b`)
  return [deviceOne.getDatabase(`${name}-a`), deviceTwo.getDatabase(`${name}-b`)]
}

async function waitUntil(condition: () => boolean | Promise<boolean>, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await condition()) return
    if (Date.now() > deadline) throw new Error('timed out waiting for replication')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

afterEach(async () => {
  for (const replication of started) replication.stop()
  started.length = 0
  await deviceOne.close()
  await deviceTwo.close()
  for (const name of databaseNames) {
    await new PouchDB(name, { adapter: 'memory' }).destroy()
  }
  databaseNames.length = 0
})

describe('Database.syncWith', () => {
  it('carries neurons both ways', async () => {
    const [local, remote] = useDatabases('sync-both')
    const fromLocal = await local.create(StringNeuron.create({ value: 'from local' }))
    const fromRemote = await remote.create(StringNeuron.create({ value: 'from remote' }))

    started.push(await local.syncWith(remote))

    await waitUntil(async () => (await local.get(fromRemote.id)) !== null)
    await waitUntil(async () => (await remote.get(fromLocal.id)) !== null)
  })

  it('seeds an empty local copy from an existing remote, then reports it caught up', async () => {
    // The mode where a remote user decides to take a local copy: the local
    // database is partial until the backlog drains, which is what the status
    // is for.
    const [local, remote] = useDatabases('sync-seed')
    for (let index = 0; index < 5; index += 1) {
      await remote.create(StringNeuron.create({ value: `existing ${index}` }))
    }

    const replication = await local.syncWith(remote)
    started.push(replication)

    await waitUntil(() => replication.isCaughtUp)
    expect(await local.list()).toHaveLength(5)
  })

  it('propagates a soft delete', async () => {
    const [local, remote] = useDatabases('sync-delete')
    const neuron = await local.create(StringNeuron.create({ value: 'doomed' }))
    started.push(await local.syncWith(remote))
    await waitUntil(async () => (await remote.get(neuron.id)) !== null)

    await local.delete(neuron)

    await waitUntil(async () => (await remote.get(neuron.id)) === null)
    expect(await remote.get(neuron.id, { includeDeleted: true })).not.toBeNull()
  })

  it('stops when told to', async () => {
    const [local, remote] = useDatabases('sync-stop')
    const replication = await local.syncWith(remote)
    await waitUntil(() => replication.isCaughtUp)

    replication.stop()
    expect(replication.status).toBe('stopped')

    await local.create(StringNeuron.create({ value: 'after stop' }))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(await remote.list()).toHaveLength(0)
  })
})

describe('Conflict resolution', () => {
  it('keeps the newer edit when two devices change one neuron offline', async () => {
    const [local, remote] = useDatabases('conflict-lww')
    const neuron = await local.create(StringNeuron.create({ value: 'original' }))
    const replication = await local.syncWith(remote)
    started.push(replication)
    await waitUntil(async () => (await remote.get(neuron.id)) !== null)
    replication.stop()

    // Both sides edit while apart. The later edit must win regardless of which
    // revision hash CouchDB would otherwise prefer.
    const onLocal = await local.get(neuron.id)
    const onRemote = await remote.get(neuron.id)
    if (onLocal === null || onRemote === null) throw new Error('setup failed')
    onLocal.updatedAt = '2026-01-01T00:00:00.000Z'
    onRemote.updatedAt = '2026-06-01T00:00:00.000Z'
    await writeDirect(local, onLocal, 'older edit')
    await writeDirect(remote, onRemote, 'newer edit')

    const watched = await local.watch({ change: () => undefined })
    started.push(await local.syncWith(remote))

    await waitUntil(async () => {
      const current = await local.get(neuron.id)
      return current !== null && valueOf(current) === 'newer edit'
    })
    watched()
  })

  it('leaves a document with no conflicts untouched', async () => {
    const [local] = useDatabases('conflict-none')
    const neuron = await local.create(StringNeuron.create({ value: 'calm' }))
    const revisionBefore = neuron.revision
    const watched = await local.watch({ change: () => undefined })

    await new Promise((resolve) => setTimeout(resolve, 300))

    const current = await local.get(neuron.id)
    expect(current?.revision).toBe(revisionBefore)
    watched()
  })
})

async function writeDirect(database: Database, neuron: unknown, value: string): Promise<void> {
  if (!(neuron instanceof StringNeuron)) throw new Error('expected a StringNeuron')
  neuron.value = value
  const client = new PouchDB(databaseNameOf(database), { adapter: 'memory' })
  await client.put(neuron.toDocument())
}

function databaseNameOf(database: Database): string {
  // The handle knows its own location; the tests only ever use local names.
  return String(Reflect.get(database, 'location'))
}

function valueOf(neuron: unknown): string | null {
  return neuron instanceof StringNeuron ? neuron.value : null
}
