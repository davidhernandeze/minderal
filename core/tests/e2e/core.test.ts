import * as library from '@minderal/core'
import { describe, expect, it } from 'vitest'

describe('public API', () => {
  it('exposes the dataset functions and errors, never the core classes', () => {
    expect(Object.keys(library).sort()).toEqual([
      'CapabilityUnavailableError',
      'CoreClosedError',
      'CoreError',
      'DatasetNotFoundError',
      'NetworkError',
      'StorageError',
      'UnsupportedRuntimeError',
      'createDataset',
      'openDataset',
    ])
  })
})
