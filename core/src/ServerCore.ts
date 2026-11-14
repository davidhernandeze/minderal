import { Core } from './Core.js'

export class ServerCore extends Core {
  readonly runtime: 'node' = 'node'

  private constructor() {
    super()
  }

  static create(): ServerCore {
    return new ServerCore()
  }
}
