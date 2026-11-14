import type { Runtime } from './Runtime.js'

export abstract class Core {
  abstract readonly runtime: Runtime

  protected constructor() {}
}
