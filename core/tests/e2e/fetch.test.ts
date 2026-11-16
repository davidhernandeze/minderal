import { CapabilityUnavailableError, CoreError, NetworkError } from '@minderal/core'
import { describe, expect, inject, it } from 'vitest'
import { createTracked } from '../support/datasets.js'

const runtime = inject('runtime')
const server = inject('httpServerUrl')

describe('core.fetch()', () => {
  describe('arguments, validated the same on every core', () => {
    it('rejects an invalid URL with a TypeError', async () => {
      await expect((await createTracked()).fetch('not a url')).rejects.toThrow(TypeError)
    })

    it('rejects a non-http URL with a TypeError', async () => {
      await expect((await createTracked()).fetch('file:///etc/hosts')).rejects.toThrow(TypeError)
    })
  })

  describe.runIf(runtime === 'nodejs')('on a ServerCore, performed locally', () => {
    it('returns the response', async () => {
      const response = await (await createTracked()).fetch(`${server}/hello`)
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
      expect(response.headers.get('x-served-by')).toBe('test-server')
      expect(await response.text()).toBe('hello')
    })

    it('returns an HTTP error status as a response, not an exception', async () => {
      const response = await (await createTracked()).fetch(`${server}/missing`)
      expect(response.status).toBe(404)
    })

    it('sends the method, headers and a text body', async () => {
      const response = await (await createTracked()).fetch(`${server}/echo`, {
        method: 'POST',
        headers: { 'x-minderal-test': 'yes', 'content-type': 'text/plain' },
        body: 'payload',
      })
      expect(await response.json()).toEqual({
        method: 'POST',
        header: 'yes',
        contentType: 'text/plain',
        bodyBase64: btoa('payload'),
      })
    })

    it('sends a binary body', async () => {
      const response = await (await createTracked()).fetch(`${server}/echo`, {
        method: 'PUT',
        body: new Uint8Array([0, 1, 254, 255]),
      })
      const echoed: unknown = await response.json()
      expect(echoed).toMatchObject({ method: 'PUT', bodyBase64: btoa(String.fromCharCode(0, 1, 254, 255)) })
    })

    it('throws NetworkError when the server cannot be reached', async () => {
      const failure = (await createTracked()).fetch(inject('closedServerUrl'))
      await expect(failure).rejects.toThrow(NetworkError)
      await expect(failure).rejects.toThrow(CoreError)
      await expect(failure).rejects.toMatchObject({ url: inject('closedServerUrl') })
    })
  })

  describe.runIf(runtime === 'browser')('on a BrowserCore with no cluster', () => {
    it('throws CapabilityUnavailableError', async () => {
      const failure = (await createTracked()).fetch(`${server}/hello`)
      await expect(failure).rejects.toThrow(CapabilityUnavailableError)
      await expect(failure).rejects.toThrow(CoreError)
      await expect(failure).rejects.toMatchObject({ capability: 'fetch' })
    })
  })
})
