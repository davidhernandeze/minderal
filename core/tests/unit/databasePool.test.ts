import { describe, expect, it } from 'vitest'
import type { DatabaseLocation } from '../../src/storage/DatabaseLocation.js'
import { DatabasePool } from '../../src/storage/DatabasePool.js'

class FakeDatabase {
  closed = 0
  async close(): Promise<void> {
    this.closed += 1
  }
}

function poolWithLog(): { pool: DatabasePool<FakeDatabase>; opened: FakeDatabase[] } {
  const opened: FakeDatabase[] = []
  const pool = new DatabasePool((_location: DatabaseLocation) => {
    const database = new FakeDatabase()
    opened.push(database)
    return database
  })
  return { pool, opened }
}

const here: DatabaseLocation = { engine: 'indexeddb', name: 'here' }
const there: DatabaseLocation = { engine: 'indexeddb', name: 'there' }

describe('DatabasePool', () => {
  it('shares one database per location', async () => {
    const { pool, opened } = poolWithLog()
    const first = await pool.acquire(here)
    const second = await pool.acquire(here)
    const elsewhere = await pool.acquire(there)
    expect(second.database).toBe(first.database)
    expect(elsewhere.database).not.toBe(first.database)
    expect(opened).toHaveLength(2)
  })

  it('closes a database only when its last handle is released', async () => {
    const { pool, opened } = poolWithLog()
    const first = await pool.acquire(here)
    const second = await pool.acquire(here)
    await first.release()
    expect(opened[0]?.closed).toBe(0)
    await second.release()
    expect(opened[0]?.closed).toBe(1)
  })

  it('ignores a second release of the same handle', async () => {
    const { pool, opened } = poolWithLog()
    const first = await pool.acquire(here)
    const second = await pool.acquire(here)
    await first.release()
    await first.release()
    expect(opened[0]?.closed).toBe(0)
    await second.release()
    expect(opened[0]?.closed).toBe(1)
  })

  it('opens a fresh database after the previous one closed', async () => {
    const { pool, opened } = poolWithLog()
    const first = await pool.acquire(here)
    const releasing = first.release()
    const next = await pool.acquire(here)
    await releasing
    expect(next.database).not.toBe(first.database)
    expect(opened).toHaveLength(2)
  })
})
