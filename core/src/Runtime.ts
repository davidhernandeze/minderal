export type Runtime = 'node' | 'browser'

export interface RuntimeScope {
  readonly process?: { readonly versions?: { readonly node?: unknown } }
  readonly window?: unknown
  readonly document?: unknown
}

export function detectRuntime(scope: RuntimeScope = globalThis): Runtime {
  if (typeof scope.process?.versions?.node === 'string') {
    return 'node'
  }
  if (scope.window !== undefined && scope.document !== undefined) {
    return 'browser'
  }
  throw new UnsupportedRuntimeError()
}

export class UnsupportedRuntimeError extends Error {
  constructor() {
    super('Minderal core could not identify the runtime: expected Node.js or a browser')
    this.name = 'UnsupportedRuntimeError'
  }
}
