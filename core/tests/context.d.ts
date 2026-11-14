import type { Runtime } from '@minderal/core'

declare module 'vitest' {
  interface ProvidedContext {
    runtime: Runtime
  }
}
