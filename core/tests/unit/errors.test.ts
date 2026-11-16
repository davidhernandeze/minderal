import { describe, expect, it } from 'vitest'
import { CapabilityUnavailableError, CoreError, NetworkError, UnsupportedRuntimeError } from '../../src/errors.js'

describe('errors', () => {
  it.each([
    ['UnsupportedRuntimeError', new UnsupportedRuntimeError()],
    ['CapabilityUnavailableError', new CapabilityUnavailableError('fetch')],
    ['NetworkError', new NetworkError('http://x.test', new TypeError('fetch failed'))],
  ])('%s is a named CoreError', (name, error) => {
    expect(error).toBeInstanceOf(CoreError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(name)
  })

  it('NetworkError keeps the underlying cause', () => {
    const cause = new TypeError('fetch failed')
    expect(new NetworkError('http://x.test', cause).cause).toBe(cause)
  })
})
