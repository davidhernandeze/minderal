import { describe, expect, it } from 'vitest'
import { BrowserCore } from '../../src/BrowserCore.js'
import { Core } from '../../src/Core.js'
import { createCoreFor } from '../../src/getCoreForCurrentRuntime.js'
import { ServerCore } from '../../src/ServerCore.js'

describe('createCoreFor()', () => {
  it('creates a BrowserCore for the browser', () => {
    const core = createCoreFor('browser')
    expect(core).toBeInstanceOf(BrowserCore)
    expect(core).toBeInstanceOf(Core)
    expect(core.runtime).toBe('browser')
  })

  it('creates a ServerCore for node', () => {
    const core = createCoreFor('node')
    expect(core).toBeInstanceOf(ServerCore)
    expect(core).toBeInstanceOf(Core)
    expect(core.runtime).toBe('node')
  })

  it('creates a new core on every call', () => {
    expect(createCoreFor('node')).not.toBe(createCoreFor('node'))
  })
})
