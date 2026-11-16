import { describe, expect, it } from 'vitest'
import { UnsupportedRuntimeError } from '../../src/errors.js'
import { detectRuntime } from '../../src/Runtime.js'

describe('detectRuntime()', () => {
  it('detects node from process.versions.node', () => {
    expect(detectRuntime({ process: { versions: { node: '22.16.0' } } })).toBe('nodejs')
  })

  it('detects a browser from window and document', () => {
    expect(detectRuntime({ window: {}, document: {} })).toBe('browser')
  })

  it('prefers node when a DOM shim is also present', () => {
    expect(detectRuntime({ process: { versions: { node: '22.16.0' } }, window: {}, document: {} })).toBe('nodejs')
  })

  it('does not take a process polyfill without a node version for node', () => {
    expect(detectRuntime({ process: { versions: {} }, window: {}, document: {} })).toBe('browser')
  })

  it('does not take a worker scope without a document for a browser', () => {
    expect(() => detectRuntime({ window: {} })).toThrow(UnsupportedRuntimeError)
  })

  it('throws UnsupportedRuntimeError on an unknown runtime', () => {
    expect(() => detectRuntime({})).toThrow(UnsupportedRuntimeError)
  })
})
