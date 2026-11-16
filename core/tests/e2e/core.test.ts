import * as library from '@minderal/core'
import { describe, expect, it } from 'vitest'

describe('public API', () => {
  it('exposes the dataset functions, the capability catalog and errors, never the core classes', () => {
    expect(Object.keys(library).sort()).toEqual([
      'CORE_VERSION',
      'CapabilityUnavailableError',
      'ClusterError',
      'CoreClosedError',
      'CoreError',
      'DatasetNotFoundError',
      'DelegationError',
      'DocumentConflictError',
      'NetworkError',
      'PartialResultError',
      'StorageError',
      'UnsupportedRuntimeError',
      'capabilities',
      'createDataset',
      'joinDataset',
      'openDataset',
    ])
  })

  it('names capabilities by immutable, versioned ids', () => {
    expect(library.capabilities.fetch.id).toBe('fetch@1')
    expect(library.capabilities.serve.id).toBe('serve@1')
    expect(Object.isFrozen(library.capabilities.fetch)).toBe(true)
  })
})
