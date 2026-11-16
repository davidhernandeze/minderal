import { fetchFromNodejs } from './capabilities/fetch/nodejs.js'
import type { LocalCapabilities } from './capabilities/LocalCapabilities.js'
import { Core, type CoreContext } from './Core.js'

export class ServerCore extends Core {
  readonly runtime: 'nodejs' = 'nodejs'
  protected readonly local: LocalCapabilities = { fetch: fetchFromNodejs }

  private constructor(context: CoreContext) {
    super(context)
  }

  static create(context: CoreContext): ServerCore {
    return new ServerCore(context)
  }
}
