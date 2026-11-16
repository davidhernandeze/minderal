import { describe, expect, it } from 'vitest'
import lock from '../../capabilities.lock.json' with { type: 'json' }
import packageJson from '../../package.json' with { type: 'json' }
import { defineCapability } from '../../src/capabilities/Capability.js'
import { allCapabilities } from '../../src/capabilities/catalog.js'
import { CapabilitySet } from '../../src/capabilities/CapabilitySet.js'
import { CORE_VERSION } from '../../src/version.js'

async function fingerprint(contract: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(contract)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('capability contracts', () => {
  it('never change once published: every capability matches capabilities.lock.json', async () => {
    const locked: Record<string, string> = lock
    for (const capability of allCapabilities) {
      const actual = await fingerprint(capability.contract)
      expect(
        locked[capability.id],
        `${capability.id} is not locked or its contract changed. A published contract never changes: define ` +
          `${capability.name}@${capability.version + 1} instead. A brand new capability is added to the lock as "${capability.id}": "${actual}".`,
      ).toBe(actual)
    }
  })

  it('never disappear: every locked id is still defined', () => {
    expect(Object.keys(lock).sort()).toEqual(allCapabilities.map(({ id }) => id).sort())
  })

  it('validate names and versions', () => {
    expect(() => defineCapability({ name: 'Fetch', version: 1, contract: { args: [], result: '' } })).toThrow(TypeError)
    expect(() => defineCapability({ name: 'fetch', version: 0, contract: { args: [], result: '' } })).toThrow(TypeError)
  })
})

describe('CapabilitySet', () => {
  const ping = defineCapability<[], string>({ name: 'ping', version: 1, contract: { args: [], result: 'pong' } })
  const camera = defineCapability<[], string>({ name: 'camera', version: 1, contract: { args: [], result: 'a photo' } })

  it('announces only what its probes say is available now', async () => {
    let permitted = false
    const set = new CapabilitySet<null>()
      .with(ping, async () => 'pong')
      .with(camera, async () => 'photo', async () => permitted)
    expect(await set.availableIds()).toEqual(['ping@1'])
    permitted = true
    expect(await set.availableIds()).toEqual(['camera@1', 'ping@1'])
  })

  it('treats a probe that throws as unavailable', async () => {
    const set = new CapabilitySet<null>().with(camera, async () => 'photo', async () => {
      throw new Error('permission API missing')
    })
    expect(await set.availableIds()).toEqual([])
  })

  it('refuses to implement a capability twice', () => {
    expect(() => new CapabilitySet<null>().with(ping, async () => 'a').with(ping, async () => 'b')).toThrow()
  })

  it('only forwards capabilities that have a wire format', () => {
    const set = new CapabilitySet<null>().with(ping, async () => 'pong')
    expect(set.forwardable('ping@1')).toBeUndefined()
  })
})

describe('CORE_VERSION', () => {
  it('matches package.json', () => {
    expect(CORE_VERSION).toBe(packageJson.version)
  })
})
