import { UnsupportedRuntimeError } from './errors.js'

export type Runtime = 'nodejs' | 'browser'

export interface RuntimeScope {
  readonly process?: { readonly versions?: { readonly node?: unknown } }
  readonly window?: unknown
  readonly document?: unknown
}

export function detectRuntime(scope: RuntimeScope = globalThis): Runtime {
  if (typeof scope.process?.versions?.node === 'string') {
    return 'nodejs'
  }
  if (scope.window !== undefined && scope.document !== undefined) {
    return 'browser'
  }
  throw new UnsupportedRuntimeError()
}
