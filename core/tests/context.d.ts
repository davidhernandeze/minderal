import type { Credentials, Runtime } from '@minderal/core'

declare module 'vitest' {
  interface ProvidedContext {
    runtime: Runtime
    httpServerUrl: string
    closedServerUrl: string
    homeRoot: string
    couchdb?: { url: string; credentials: Credentials }
  }
}
