import { Core } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'

describe('Core', () => {
  it('is the same instance on every import', async () => {
    const again = await import('@minderal/core')
    expect(again.Core).toBe(Core)
  })

  describe('init()', () => {
    it('resolves to the runtime it is running on', async () => {
      await expect(Core.init()).resolves.toBe(inject('runtime'))
    })

    it('resolves to the same runtime on every call', async () => {
      expect(await Core.init()).toBe(await Core.init())
    })
  })
})
