import * as library from '@minderal/core'
import { getCoreForCurrentRuntime } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'

describe('getCoreForCurrentRuntime()', () => {
  it('returns a core for the runtime it is running on', () => {
    expect(getCoreForCurrentRuntime().runtime).toBe(inject('runtime'))
  })

  it('returns a new, independent core on every call', () => {
    const first = getCoreForCurrentRuntime()
    const second = getCoreForCurrentRuntime()
    expect(second).not.toBe(first)
    expect(second.runtime).toBe(first.runtime)
  })
})

describe('public API', () => {
  it('exposes the factory, not the core classes', () => {
    expect(Object.keys(library).sort()).toEqual(['UnsupportedRuntimeError', 'getCoreForCurrentRuntime'])
  })
})
